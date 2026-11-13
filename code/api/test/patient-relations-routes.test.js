import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import { createPatientRelationsRouter, migratePatientRelations } from '../src/patient-relations.js';

const WEB_ORIGIN = 'http://web.example.invalid';

async function fixture(t) {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, emailVerified INTEGER, name TEXT, twoFactorEnabled INTEGER);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE REFERENCES user(id));
    CREATE TABLE physician_review_application (
      id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE, status TEXT
    );
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT, token TEXT, expiresAt TEXT);
    CREATE TABLE twoFactor (userId TEXT PRIMARY KEY, verified INTEGER);
    CREATE TABLE totp_step_up_attempt (
      session_id TEXT PRIMARY KEY, user_id TEXT, verified_at INTEGER, expires_at INTEGER
    );
  `);
  const insertUser = database.prepare('INSERT INTO user VALUES (?, ?, 1, ?, 1)');
  const insertProfile = database.prepare('INSERT INTO patient_profile VALUES (?, ?)');
  const insertSession = database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)');
  const nowIso = new Date(Date.now() + 60_000).toISOString();
  const sessionByCookie = new Map();
  for (const [id, email, name] of [
    ['doctor-a', 'doctor-a@example.invalid', 'Doctor A'], ['doctor-b', 'doctor-b@example.invalid', 'Doctor B'],
    ['patient-a', 'patient-a@example.invalid', 'Patient A'], ['patient-b', 'patient-b@example.invalid', 'Patient B'],
  ]) {
    insertUser.run(id, email, name);
    const sessionId = `${id}-session`;
    const token = `${id}-session-token`;
    insertSession.run(sessionId, id, token, nowIso);
    database.prepare('INSERT INTO twoFactor VALUES (?, 1)').run(id);
    sessionByCookie.set(id, { user: { id, email, name, emailVerified: true }, session: { id: sessionId } });
    sessionByCookie.set(`${id}-unverified`, { user: { id, email, name, emailVerified: false }, session: { id: sessionId } });
  }
  insertProfile.run('profile-a', 'patient-a');
  insertProfile.run('profile-b', 'patient-b');
  migratePatientRelations(database);

  // These are deterministic test adapters for guard behavior. They inspect
  // current SQLite state, but do not claim to perform a real Better Auth or TOTP proof.
  const guards = {
    isPhysicianApprovedInTransaction({ user }) {
      return database.prepare(`SELECT 1 FROM physician_review_application
        WHERE account_user_id = ? AND status = 'approved'`).get(user.id) !== undefined;
    },
    hasPhysicianAssuranceInTransaction({ user, session }) {
      if (!session?.session?.id) return false;
      const row = database.prepare(`SELECT 1 FROM session s
        JOIN user u ON u.id = s.userId
        JOIN twoFactor tf ON tf.userId = u.id
        JOIN totp_step_up_attempt step ON step.session_id = s.id AND step.user_id = u.id
        WHERE s.id = ? AND s.userId = ? AND s.expiresAt > ? AND u.twoFactorEnabled = 1
          AND tf.verified = 1 AND step.expires_at > ?`).get(
        session.session.id, user.id, new Date().toISOString(), Date.now());
      return Boolean(row);
    },
    isPhysicianCurrentlyApprovedInTransaction({ physicianUserId }) {
      return database.prepare(`SELECT 1 FROM physician_review_application
        WHERE account_user_id = ? AND status = 'approved'`).get(physicianUserId) !== undefined;
    },
  };
  const auth = { api: { async getSession({ headers }) {
    const cookie = headers.get('cookie') ?? '';
    const token = cookie.match(/(?:^|;\s*)test_session=([^;]+)/)?.[1];
    return sessionByCookie.get(decodeURIComponent(token ?? '')) ?? null;
  } } };
  const app = express();
  app.use('/api/care', createPatientRelationsRouter(auth, database, {
    webOrigin: WEB_ORIGIN, invitationLifetimeMs: 60_000, guards,
  }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: 'internal_error', detail: error.message }));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    database.close();
  });
  return {
    database,
    async request(path, { actor, method = 'GET', body, origin = WEB_ORIGIN, contentType = 'application/json' } = {}) {
      const response = await fetch(`${baseUrl}/api/care${path}`, {
        method,
        headers: {
          ...(actor ? { Cookie: `test_session=${encodeURIComponent(actor)}` } : {}),
          ...(method !== 'GET' ? { Origin: origin, 'Content-Type': contentType } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    },
    approve(physicianId) {
      database.prepare("INSERT INTO physician_review_application VALUES (?, ?, 'approved')")
        .run(`application-${physicianId}`, physicianId);
    },
    proveStepUp(physicianId) {
      database.prepare('INSERT INTO totp_step_up_attempt VALUES (?, ?, ?, ?)')
        .run(`${physicianId}-session`, physicianId, Date.now(), Date.now() + 30_000);
    },
  };
}

test('HTTP route denies missing auth, approval, assurance, and foreign invitation acceptance', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/patient')).status, 401);
  assert.equal((await f.request('/invitations', { actor: 'doctor-a', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } })).status, 403);
  f.approve('doctor-a');
  assert.equal((await f.request('/invitations', { actor: 'doctor-a', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } })).status, 403);
  f.proveStepUp('doctor-a');
  assert.equal((await f.request('/invitations', { actor: 'doctor-a', method: 'POST', origin: 'http://foreign.invalid', body: { patientEmail: 'patient-a@example.invalid' } })).status, 403);
  const invitation = await f.request('/invitations', { actor: 'doctor-a', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } });
  assert.equal(invitation.status, 201, JSON.stringify(invitation.body));
  assert.equal(invitation.body.invitation.status, 'open');
  assert.equal((await f.request(`/invitations/${invitation.body.invitation.id}/accept`, { actor: 'patient-b', method: 'POST', body: {} })).status, 404);
  assert.equal((await f.request(`/invitations/${invitation.body.invitation.id}/accept`, { actor: 'patient-a-unverified', method: 'POST', body: {} })).status, 403);
  assert.equal((await f.request(`/invitations/${invitation.body.invitation.id}/accept`, { actor: 'patient-a', method: 'POST', body: {} })).status, 201);
  assert.equal((await f.request('/patient', { actor: 'patient-a' })).body.relationship.status, 'active');
  assert.equal((await f.request('/patient', { actor: 'patient-b' })).body.relationship, null);
});

test('HTTP switch and decline enforce active access, explicit acceptance, and DB guard refresh', async t => {
  const f = await fixture(t);
  f.approve('doctor-a');
  f.proveStepUp('doctor-a');
  const first = await f.request('/invitations', { actor: 'doctor-a', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal((await f.request('/physician/patients', { actor: 'doctor-a' })).body.patients.length, 0);
  assert.equal((await f.request(`/invitations/${first.body.invitation.id}/accept`, { actor: 'patient-a', method: 'POST', body: {} })).status, 201);
  assert.equal((await f.request('/physician/patients', { actor: 'doctor-a' })).body.patients.length, 1);

  f.approve('doctor-b');
  f.proveStepUp('doctor-b');
  const pending = await f.request('/invitations', { actor: 'doctor-b', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } });
  assert.equal(pending.status, 201);
  const foreignDecline = await f.request(`/invitations/${pending.body.invitation.id}/decline`, { actor: 'patient-b', method: 'POST', body: {} });
  assert.equal(foreignDecline.status, 404);
  const decline = await f.request(`/invitations/${pending.body.invitation.id}/decline`, { actor: 'patient-a', method: 'POST', body: {} });
  assert.deepEqual(decline.body.invitation, { id: pending.body.invitation.id, status: 'declined' });
  assert.equal((await f.request('/physician/patients', { actor: 'doctor-a' })).body.patients.length, 1);

  const switchInvite = await f.request('/invitations', { actor: 'doctor-b', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } });
  f.database.prepare("UPDATE physician_review_application SET status = 'pending' WHERE account_user_id = 'doctor-b'").run();
  assert.equal((await f.request(`/invitations/${switchInvite.body.invitation.id}/accept`, { actor: 'patient-a', method: 'POST', body: {} })).status, 403);
  assert.equal((await f.request('/physician/patients', { actor: 'doctor-a' })).body.patients.length, 1);
  f.database.prepare("UPDATE physician_review_application SET status = 'approved' WHERE account_user_id = 'doctor-b'").run();
  assert.equal((await f.request(`/invitations/${switchInvite.body.invitation.id}/accept`, { actor: 'patient-a', method: 'POST', body: {} })).status, 201);
  assert.equal((await f.request('/physician/patients', { actor: 'doctor-a' })).body.patients.length, 0);
  assert.equal((await f.request('/physician/patients', { actor: 'doctor-b' })).body.patients.length, 1);
});

test('HTTP concurrent acceptance and decline produce a single terminal state', async t => {
  const f = await fixture(t);
  f.approve('doctor-a');
  f.proveStepUp('doctor-a');
  const created = await f.request('/invitations', { actor: 'doctor-a', method: 'POST', body: { patientEmail: 'patient-a@example.invalid' } });
  const id = created.body.invitation.id;
  const [accept, decline] = await Promise.all([
    f.request(`/invitations/${id}/accept`, { actor: 'patient-a', method: 'POST', body: {} }),
    f.request(`/invitations/${id}/decline`, { actor: 'patient-a', method: 'POST', body: {} }),
  ]);
  assert.equal([accept, decline].filter(result => result.status === 201 || result.status === 200).length, 1);
  assert.equal([accept, decline].filter(result => result.status === 409).length, 1);
  assert.equal(f.database.prepare("SELECT count(*) AS n FROM patient_relation WHERE status = 'active'").get().n, accept.status === 201 ? 1 : 0);
});
