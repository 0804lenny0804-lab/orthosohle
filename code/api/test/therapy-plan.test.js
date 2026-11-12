import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import { createTherapyPlanRouter, migrateTherapyPlans, createTherapyPlanRepository } from '../src/therapy-plan.js';
import { migratePatientRelations } from '../src/patient-relations.js';

const ORIGIN = 'http://web.example.invalid';
const P_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function fixture(t) {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, email TEXT, emailVerified INTEGER, twoFactorEnabled INTEGER);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT, token TEXT, expiresAt TEXT);
    CREATE TABLE twoFactor (userId TEXT PRIMARY KEY, verified INTEGER);
    CREATE TABLE totp_step_up_attempt (session_id TEXT PRIMARY KEY, user_id TEXT, verified_at INTEGER, expires_at INTEGER);
    CREATE TABLE physician_review_application (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE, status TEXT);
  `);
  migratePatientRelations(database);
  migrateTherapyPlans(database);
  migrateTherapyPlans(database);
  const now = Date.now();
  const identities = new Map();
  for (const id of ['doctor-a', 'doctor-b', 'patient-a', 'patient-b']) {
    database.prepare('INSERT INTO user VALUES (?, ?, ?, 1, 1)').run(id, id, `${id}@example.invalid`);
    const sid = `${id}-session`, token = `${id}-token`;
    database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run(sid, id, token, new Date(now + 60_000).toISOString());
    database.prepare('INSERT INTO twoFactor VALUES (?, 1)').run(id);
    identities.set(id, { user: { id, emailVerified: true }, session: { id: sid, userId: id, token } });
  }
  database.prepare('INSERT INTO patient_profile VALUES (?, ?)').run(P_A, 'patient-a');
  database.prepare('INSERT INTO patient_profile VALUES (?, ?)').run(P_B, 'patient-b');
  for (const physician of ['doctor-a', 'doctor-b']) {
    database.prepare('INSERT INTO physician_review_application VALUES (?, ?, ?)').run(`app-${physician}`, physician, 'approved');
    database.prepare('INSERT INTO totp_step_up_attempt VALUES (?, ?, ?, ?)')
      .run(`${physician}-session`, physician, now, now + 30_000);
  }
  function relate(physician, profile, invitation) {
    database.prepare(`INSERT INTO patient_invitation VALUES (?, ?, ?, ?, 'accepted', ?, ?)`).run(
      invitation, physician, profile, profile === P_A ? 'patient-a' : 'patient-b', new Date(now).toISOString(), new Date(now + 60_000).toISOString());
    database.prepare(`INSERT INTO patient_relation
      (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
      VALUES (?, ?, ?, ?, 'active', ?)`).run(`relation-${invitation}`, physician, profile, invitation, new Date(now).toISOString());
  }
  relate('doctor-a', P_A, 'invite-a');
  relate('doctor-b', P_B, 'invite-b');
  migrateTherapyPlans(database);
  assert.equal(database.prepare('SELECT count(*) AS n FROM patient_profile').get().n, 2);
  assert.equal(database.prepare('SELECT count(*) AS n FROM patient_relation').get().n, 2);

  const auth = { api: { async getSession({ headers }) {
    const cookie = headers.get('cookie') ?? '';
    const id = cookie.match(/(?:^|;\s*)test_session=([^;]+)/)?.[1];
    return identities.get(decodeURIComponent(id ?? '')) ?? null;
  } } };
  const approved = ({ user }) => database.prepare(`SELECT 1 FROM physician_review_application
    WHERE account_user_id = ? AND status = 'approved'`).get(user.id) !== undefined;
  const app = express();
  app.use('/api/care', createTherapyPlanRouter(auth, database, { webOrigin: ORIGIN,
    guards: { isPhysicianApprovedInTransaction: approved } }));
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
    relate,
    async request(method, path, actor, body, { origin = ORIGIN } = {}) {
      const headers = {};
      if (actor) headers.Cookie = `test_session=${encodeURIComponent(actor)}`;
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers.Origin = origin; }
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/care${path}`, {
        method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

test('physicians create immutable per-profile versions with actor, timestamp and optimistic concurrency', async t => {
  const f = await fixture(t);
  const created = await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 1.001, expectedVersion: null });
  assert.equal(created.status, 201);
  assert.deepEqual({ version: created.body.plan.version, limitKg: created.body.plan.limitKg, unit: created.body.plan.unit, authoredBy: created.body.plan.authoredBy },
    { version: 1, limitKg: 1.001, unit: 'kg', authoredBy: 'doctor-a' });
  assert.equal(created.body.plan.authorName, 'doctor-a');
  assert.ok(created.body.plan.createdAt);
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 70, expectedVersion: null })).status, 409);
  const next = await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 70, expectedVersion: 1 });
  assert.equal(next.body.plan.version, 2);
  assert.equal((await f.request('GET', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a')).body.plans.length, 2);
  assert.equal((await f.request('GET', `/physician/patients/${P_A}/therapy-plans`, 'doctor-b')).status, 404);
  assert.equal((await f.request('GET', `/physician/patients/${P_B}/therapy-plans`, 'doctor-a')).status, 404);
  assert.equal(f.database.prepare("SELECT count(*) AS n FROM therapy_plan_audit WHERE action = 'created'").get().n, 2);
  assert.throws(() => f.database.prepare('UPDATE therapy_plan_version SET limit_kg = 99 WHERE id = ?').run(created.body.plan.id), /immutable/);
});

test('only the patient explicitly confirms their current version; replay is idempotent and atomic', async t => {
  const f = await fixture(t);
  const created = await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 50, expectedVersion: null });
  const planId = created.body.plan.id;
  const before = await f.request('GET', '/patient/therapy-plan', 'patient-a');
  assert.equal(before.body.plan.id, planId);
  assert.equal(before.body.confirmedAt, null);
  assert.equal((await f.request('POST', '/patient/therapy-plan/confirm', 'patient-b', { versionId: planId })).status, 409);
  const first = await f.request('POST', '/patient/therapy-plan/confirm', 'patient-a', { versionId: planId });
  const replay = await f.request('POST', '/patient/therapy-plan/confirm', 'patient-a', { versionId: planId });
  assert.equal(first.body.confirmation.alreadyConfirmed, false);
  assert.equal(replay.body.confirmation.alreadyConfirmed, true);
  assert.equal(first.body.confirmation.confirmedAt, replay.body.confirmation.confirmedAt);
  assert.equal(f.database.prepare("SELECT count(*) AS n FROM therapy_plan_audit WHERE action = 'confirmed'").get().n, 1);
  assert.throws(() => f.database.prepare('DELETE FROM therapy_plan_confirmation WHERE plan_version_id = ?').run(planId), /immutable/);
});

test('invalid values, origin, unverified sessions, revoked approvals, stale sessions and missing fresh TOTP fail', async t => {
  const f = await fixture(t);
  for (const limitKg of [0, -1, 1_000_000.001, 1.0011, 1.1234, NaN]) {
    assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg, expectedVersion: null })).status, 400);
  }
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 12, expectedVersion: null }, { origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request('GET', `/physician/patients/${P_A}/therapy-plans`, null)).status, 401);
  f.database.prepare('UPDATE physician_review_application SET status = ? WHERE account_user_id = ?').run('revoked', 'doctor-a');
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 12, expectedVersion: null })).status, 403);
  f.database.prepare('UPDATE physician_review_application SET status = ? WHERE account_user_id = ?').run('approved', 'doctor-a');
  f.database.prepare('UPDATE user SET emailVerified = 0 WHERE id = ?').run('doctor-a');
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 12, expectedVersion: null })).status, 403);
  f.database.prepare('UPDATE user SET emailVerified = 1 WHERE id = ?').run('doctor-a');
  f.database.prepare('UPDATE totp_step_up_attempt SET expires_at = ? WHERE user_id = ?').run(Date.now() - 1, 'doctor-a');
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 12, expectedVersion: null })).status, 403);
  f.database.prepare('DELETE FROM session WHERE userId = ?').run('doctor-a');
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 12, expectedVersion: null })).status, 403);
});

test('a new active physician sees old history in their own view but patient current stays empty until new authorship', async t => {
  const f = await fixture(t);
  const old = await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 55, expectedVersion: null });
  assert.equal((await f.request('GET', '/patient/therapy-plan', 'patient-a')).body.plan.id, old.body.plan.id);
  f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE patient_profile_id = ?").run(P_A);
  f.relate('doctor-b', P_A, 'switch-invite');
  const afterSwitch = (await f.request('GET', '/patient/therapy-plan', 'patient-a')).body;
  assert.equal(afterSwitch.plan, null);
  assert.equal(afterSwitch.previousPlanStatus, 'continuation_undetermined');
  assert.equal(afterSwitch.relationship.relationshipId, 'relation-switch-invite');
  assert.equal((await f.request('GET', `/physician/patients/${P_A}/therapy-plans`, 'doctor-b')).body.plans.length, 1);
  assert.equal((await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-b', { limitKg: 60, expectedVersion: null })).status, 201);
  f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE patient_profile_id = ? AND status = 'active'").run(P_A);
  f.relate('doctor-a', P_A, 'return-invite');
  const returnedDoctorView = await f.request('GET', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a');
  assert.equal(returnedDoctorView.body.currentVersion, null);
  const patientAfterReturn = (await f.request('GET', '/patient/therapy-plan', 'patient-a')).body;
  assert.equal(patientAfterReturn.plan, null);
  assert.equal(patientAfterReturn.previousPlanStatus, 'continuation_undetermined');
  const newRelationshipPlan = await f.request('POST', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a', { limitKg: 65, expectedVersion: null });
  assert.equal(newRelationshipPlan.body.plan.version, 3);
  assert.equal(newRelationshipPlan.body.plan.relationshipId, 'relation-return-invite');
  assert.deepEqual((await f.request('GET', `/physician/patients/${P_A}/therapy-plans`, 'doctor-a')).body.plans.map(plan => plan.version), [3, 2, 1]);
});

test('concurrent expected-version writers create only one successor; repository confirmation also has one winner', async t => {
  const f = await fixture(t);
  const repository = createTherapyPlanRepository(f.database);
  const initial = repository.createVersion(P_A, 'doctor-a', 40, null);
  const writes = await Promise.all([
    Promise.resolve().then(() => repository.createVersion(P_A, 'doctor-a', 41, 1)),
    Promise.resolve().then(() => repository.createVersion(P_A, 'doctor-a', 42, 1)),
  ]);
  assert.equal(writes.filter(result => result.kind === 'created').length, 1);
  assert.equal(writes.filter(result => result.kind === 'stale_version').length, 1);
  const current = repository.history(P_A)[0];
  const confirms = await Promise.all([
    Promise.resolve().then(() => repository.confirm('patient-a', current.id)),
    Promise.resolve().then(() => repository.confirm('patient-a', current.id)),
  ]);
  assert.equal(confirms.filter(result => result.kind === 'confirmed').length, 2);
  assert.equal(confirms.filter(result => result.confirmation.alreadyConfirmed === false).length, 1);
  assert.equal(confirms.filter(result => result.confirmation.alreadyConfirmed === true).length, 1);
  assert.equal(initial.plan.version, 1);
});

test('version and audit rows commit atomically when audit insertion fails', async t => {
  const f = await fixture(t);
  const repository = createTherapyPlanRepository(f.database);
  f.database.exec(`CREATE TRIGGER reject_therapy_plan_audit BEFORE INSERT ON therapy_plan_audit
    BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;`);
  assert.throws(() => repository.createVersion(P_A, 'doctor-a', 33, null), /synthetic audit failure/);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM therapy_plan_version WHERE patient_profile_id = ?').get(P_A).n, 0);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM therapy_plan_audit').get().n, 0);
});
