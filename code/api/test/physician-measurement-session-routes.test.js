import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import { createPhysicianMeasurementSessionRouter } from '../src/physician-measurement-session-routes.js';
import { migratePatientRelations } from '../src/patient-relations.js';

const ORIGIN = 'http://web.example.invalid';
const P_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const M_A = '11111111-1111-4111-8111-111111111111';
const M_B = '22222222-2222-4222-8222-222222222222';
const M_A2 = '33333333-3333-4333-8333-333333333333';

async function fixture(t) {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, emailVerified INTEGER, twoFactorEnabled INTEGER);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT, token TEXT, expiresAt TEXT);
    CREATE TABLE twoFactor (userId TEXT PRIMARY KEY, verified INTEGER);
    CREATE TABLE totp_step_up_attempt (session_id TEXT PRIMARY KEY, user_id TEXT, verified_at INTEGER, expires_at INTEGER);
    CREATE TABLE physician_review_application (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE, status TEXT);
    CREATE TABLE measurement_session (id TEXT PRIMARY KEY, patient_profile_id TEXT, source TEXT, started_at TEXT, ended_at TEXT, payload_hash TEXT, created_at TEXT);
    CREATE TABLE measurement_interval (session_id TEXT, received_at TEXT, sample_count INTEGER, average REAL, maximum REAL);
  `);
  migratePatientRelations(database);
  const now = Date.now();
  const identities = new Map();
  let authPause = null;
  for (const [id, verified] of [['doctor-a', 1], ['doctor-b', 1], ['patient-a', 1], ['patient-b', 1]]) {
    database.prepare('INSERT INTO user VALUES (?, ?, ?, 1)').run(id, `${id}@example.invalid`, verified);
    database.prepare('INSERT INTO twoFactor VALUES (?, 1)').run(id);
    const sid = `${id}-session`, token = `${id}-cookie-token`;
    database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run(sid, id, token, new Date(now + 60_000).toISOString());
    identities.set(id, { user: { id, emailVerified: Boolean(verified) }, session: { id: sid, userId: id, token } });
  }
  database.prepare('INSERT INTO patient_profile VALUES (?, ?)').run(P_A, 'patient-a');
  database.prepare('INSERT INTO patient_profile VALUES (?, ?)').run(P_B, 'patient-b');
  const relation = database.prepare(`INSERT INTO patient_relation
    (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
    VALUES (?, ?, ?, ?, 'active', ?)`);
  // The invitation table is only used as a relation integrity anchor here.
  for (const [id, physician, profile] of [['inv-a', 'doctor-a', P_A], ['inv-b', 'doctor-b', P_B]]) {
    database.prepare(`INSERT INTO patient_invitation
      (id, physician_user_id, patient_profile_id, target_user_id, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, 'accepted', ?, ?)`)
      .run(id, physician, profile, `patient-${profile === P_A ? 'a' : 'b'}`, new Date(now).toISOString(), new Date(now + 60_000).toISOString());
    relation.run(`relation-${id}`, physician, profile, id, new Date(now).toISOString());
  }
  for (const physician of ['doctor-a', 'doctor-b']) {
    database.prepare('INSERT INTO physician_review_application VALUES (?, ?, ?)')
      .run(`application-${physician}`, physician, 'approved');
    database.prepare('INSERT INTO totp_step_up_attempt VALUES (?, ?, ?, ?)')
      .run(`${physician}-session`, physician, now, now + 30_000);
  }
  const sessionInsert = database.prepare(`INSERT INTO measurement_session
    VALUES (?, ?, 'ble', ?, ?, 'hash', ?)`);
  for (const [id, profile] of [[M_A, P_A], [M_B, P_B]]) {
    sessionInsert.run(id, profile, '2026-11-11T10:00:00.000Z', '2026-11-11T10:00:02.000Z', new Date(now).toISOString());
    database.prepare('INSERT INTO measurement_interval VALUES (?, ?, 2, 4, 6)')
      .run(id, '2026-11-11T10:00:01.000Z');
  }
  sessionInsert.run(M_A2, P_A, '2026-11-11T10:00:00.000Z', '2026-11-11T10:00:03.000Z', new Date(now).toISOString());
  database.prepare('INSERT INTO measurement_interval VALUES (?, ?, 3, 5, 7)')
    .run(M_A2, '2026-11-11T10:00:02.000Z');
  const auth = { api: { async getSession({ headers }) {
    const cookie = headers.get('cookie') ?? '';
    const id = cookie.match(/(?:^|;\s*)test_session=([^;]+)/)?.[1];
    const result = identities.get(decodeURIComponent(id ?? '')) ?? null;
    if (authPause) {
      const pause = authPause;
      authPause = null;
      pause.entered();
      await pause.wait;
    }
    return result;
  } } };
  const isApproved = ({ user }) => database.prepare(`SELECT 1 FROM physician_review_application
    WHERE account_user_id = ? AND status = 'approved'`).get(user.id) !== undefined;
  const app = express();
  app.use('/api/care/physician', createPhysicianMeasurementSessionRouter(auth, database, {
    guards: { isPhysicianApprovedInTransaction: isApproved },
  }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    database.close();
  });
  return {
    database,
    pauseNextSessionLookup() {
      let entered;
      let release;
      const enteredPromise = new Promise(resolve => { entered = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      authPause = { entered, wait };
      return { entered: enteredPromise, release };
    },
    async get(path, actor) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/care/physician${path}`, {
        headers: actor ? { Cookie: `test_session=${encodeURIComponent(actor)}` } : {},
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

test('list and detail are restricted to the selected actively assigned patient', async t => {
  const f = await fixture(t);
  assert.equal((await f.get(`/patients/${P_A}/measurement-sessions`, 'doctor-a')).body.sessions[0].id, M_A2);
  assert.equal((await f.get(`/patients/${P_B}/measurement-sessions`, 'doctor-a')).status, 404);
  assert.equal((await f.get(`/patients/${P_A}/measurement-sessions/${M_B}`, 'doctor-a')).status, 404);
  const detail = await f.get(`/patients/${P_A}/measurement-sessions/${M_A}`, 'doctor-a');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.session.samples.length, 1);
  assert.equal((await f.get(`/patients/${P_A}/measurement-sessions`, 'doctor-b')).status, 404);
  assert.equal((await f.get(`/patients/${P_B}/measurement-sessions/${M_B}`, 'doctor-b')).status, 200);
  assert.equal((await f.get(`/patients/${P_A}/measurement-sessions`, 'patient-a')).status, 403);
  assert.equal((await f.get(`/patients/${P_A}/measurement-sessions`)).status, 401);
});

test('every read rechecks approval, active relation, MFA freshness, verified email, and exact live session', async t => {
  const f = await fixture(t);
  const list = `/patients/${P_A}/measurement-sessions`;
  f.database.prepare("UPDATE physician_review_application SET status = 'revoked' WHERE account_user_id = 'doctor-a'").run();
  assert.equal((await f.get(list, 'doctor-a')).status, 403);
  f.database.prepare("UPDATE physician_review_application SET status = 'approved' WHERE account_user_id = 'doctor-a'").run();
  f.database.prepare('UPDATE totp_step_up_attempt SET expires_at = ? WHERE session_id = ?').run(Date.now() - 1, 'doctor-a-session');
  assert.equal((await f.get(list, 'doctor-a')).status, 403);
  f.database.prepare('UPDATE totp_step_up_attempt SET expires_at = ? WHERE session_id = ?').run(Date.now() + 30_000, 'doctor-a-session');
  f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE physician_user_id = 'doctor-a'").run();
  assert.equal((await f.get(list, 'doctor-a')).status, 404);
  f.database.prepare("UPDATE patient_relation SET status = 'active' WHERE physician_user_id = 'doctor-a'").run();
  f.database.prepare("UPDATE user SET emailVerified = 0 WHERE id = 'doctor-a'").run();
  assert.equal((await f.get(list, 'doctor-a')).status, 403);
  f.database.prepare("UPDATE user SET emailVerified = 1 WHERE id = 'doctor-a'").run();
  f.database.prepare("DELETE FROM session WHERE id = 'doctor-a-session'").run();
  assert.equal((await f.get(list, 'doctor-a')).status, 403);
});

test('pagination validates bounds and uses id as a stable tie-break for equal timestamps', async t => {
  const f = await fixture(t);
  const path = `/patients/${P_A}/measurement-sessions`;
  const first = await f.get(`${path}?limit=1`, 'doctor-a');
  assert.equal(first.status, 200);
  assert.equal(first.body.sessions.length, 1);
  assert.equal(first.body.sessions[0].id, M_A2);
  assert.deepEqual(first.body.nextBefore, { startedAt: '2026-11-11T10:00:00.000Z', id: M_A2 });
  const cursor = encodeURIComponent(JSON.stringify(first.body.nextBefore));
  const second = await f.get(`${path}?limit=1&before=${cursor}`, 'doctor-a');
  assert.equal(second.body.sessions[0].id, M_A);
  assert.equal(second.body.nextBefore, null);
  assert.equal((await f.get(`${path}?limit=0`, 'doctor-a')).status, 400);
  assert.equal((await f.get(`${path}?limit=51`, 'doctor-a')).status, 400);
  assert.equal((await f.get(`${path}?before=bad`, 'doctor-a')).status, 400);
  assert.equal((await f.get(`${path}?before=${encodeURIComponent(JSON.stringify({ id: 'not-an-id', startedAt: '2026-11-11T10:00:00.000Z' }))}`, 'doctor-a')).status, 400);
});

test('session revocation and an accepted physician switch immediately remove read access', async t => {
  const f = await fixture(t);
  const path = `/patients/${P_A}/measurement-sessions`;
  f.database.prepare("DELETE FROM session WHERE id = 'doctor-a-session'").run();
  assert.equal((await f.get(path, 'doctor-a')).status, 403);
  f.database.prepare("INSERT INTO session VALUES ('doctor-a-session', 'doctor-a', 'doctor-a-cookie-token', ?)")
    .run(new Date(Date.now() + 60_000).toISOString());
  f.database.prepare(`INSERT INTO patient_invitation
    (id, physician_user_id, patient_profile_id, target_user_id, status, created_at, expires_at)
    VALUES ('switch-invite', 'doctor-b', ?, 'patient-a', 'accepted', ?, ?)`)
    .run(P_A, new Date().toISOString(), new Date(Date.now() + 60_000).toISOString());
  f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE physician_user_id = 'doctor-a' AND patient_profile_id = ?").run(P_A);
  f.database.prepare(`INSERT INTO patient_relation
    (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
    VALUES ('relation-switch', 'doctor-b', ?, 'switch-invite', 'active', ?)`)
    .run(P_A, new Date().toISOString());
  assert.equal((await f.get(path, 'doctor-a')).status, 404);
  assert.equal((await f.get(path, 'doctor-b')).body.sessions[0].id, M_A2);
});

test('authorization change between auth lookup and SQLite transaction denies the pending read', async t => {
  const f = await fixture(t);
  const pause = f.pauseNextSessionLookup();
  const pending = f.get(`/patients/${P_A}/measurement-sessions/${M_A}`, 'doctor-a');
  await pause.entered;
  f.database.transaction(() => {
    f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE physician_user_id = 'doctor-a'").run();
  }).immediate();
  pause.release();
  const result = await pending;
  assert.equal(result.status, 404);
  assert.equal(JSON.stringify(result.body).includes(M_A), false);
});
