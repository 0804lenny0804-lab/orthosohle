import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import { createPatientProfileRouter } from '../src/patient-profile-routes.js';
import { migratePatientProfiles } from '../src/patient-profile-migration.js';
import { migratePatientRelations } from '../src/patient-relations.js';

const ORIGIN = 'http://web.example.invalid';

async function fixture(t) {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, email TEXT, emailVerified INTEGER, twoFactorEnabled INTEGER);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE, created_at TEXT);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT, token TEXT, expiresAt TEXT);
    CREATE TABLE twoFactor (userId TEXT PRIMARY KEY, verified INTEGER);
    CREATE TABLE totp_step_up_attempt (session_id TEXT PRIMARY KEY, user_id TEXT, verified_at INTEGER, expires_at INTEGER);
    CREATE TABLE physician_review_application (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE, status TEXT);
  `);
  const now = Date.now();
  const identities = new Map();
  for (const id of ['doctor-a', 'doctor-b', 'patient-a', 'patient-b', 'patient-new']) {
    database.prepare('INSERT INTO user VALUES (?, ?, ?, 1, 1)').run(id, id, `${id}@example.invalid`);
    database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run(`${id}-session`, id, `${id}-token`, new Date(now + 60_000).toISOString());
    database.prepare('INSERT INTO twoFactor VALUES (?, 1)').run(id);
    identities.set(id, { user: { id, emailVerified: true }, session: { id: `${id}-session`, userId: id, token: `${id}-token` } });
  }
  database.prepare('INSERT INTO patient_profile VALUES (?, ?, ?)').run('profile-a', 'patient-a', '2026-01-01T00:00:00.000Z');
  database.prepare('INSERT INTO patient_profile VALUES (?, ?, ?)').run('profile-b', 'patient-b', '2026-01-01T00:00:00.000Z');
  migratePatientProfiles(database);
  migratePatientProfiles(database);
  migratePatientRelations(database);
  for (const physician of ['doctor-a', 'doctor-b']) {
    database.prepare('INSERT INTO physician_review_application VALUES (?, ?, ?)').run(`app-${physician}`, physician, 'approved');
    database.prepare('INSERT INTO totp_step_up_attempt VALUES (?, ?, ?, ?)').run(`${physician}-session`, physician, now, now + 30_000);
  }
  function relate(physician, profile, patient, suffix) {
    database.prepare(`INSERT INTO patient_invitation VALUES (?, ?, ?, ?, 'accepted', ?, ?)`).run(
      `invite-${suffix}`, physician, profile, patient, new Date(now).toISOString(), new Date(now + 60_000).toISOString());
    database.prepare(`INSERT INTO patient_relation (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
      VALUES (?, ?, ?, ?, 'active', ?)`).run(`relation-${suffix}`, physician, profile, `invite-${suffix}`, new Date(now).toISOString());
  }
  relate('doctor-a', 'profile-a', 'patient-a', 'a');
  relate('doctor-b', 'profile-b', 'patient-b', 'b');
  const auth = { api: { async getSession({ headers }) {
    const actor = (headers.get('cookie') ?? '').match(/(?:^|;\s*)test_session=([^;]+)/)?.[1];
    return identities.get(decodeURIComponent(actor ?? '')) ?? null;
  } } };
  const app = express();
  app.use('/profile', createPatientProfileRouter(auth, database, ORIGIN));
  app.use((_error, _req, res, _next) => res.status(500).json({ error: 'request_failed' }));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    database.close();
  });
  return {
    database,
    async request(method, path, actor, body, { origin = ORIGIN } = {}) {
      const headers = {};
      if (actor) headers.Cookie = `test_session=${encodeURIComponent(actor)}`;
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers.Origin = origin; }
      const response = await fetch(`http://127.0.0.1:${server.address().port}/profile${path}`, {
        method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

test('patients read and update only their own small profile with versioned atomic audit', async t => {
  const f = await fixture(t);
  const before = await f.request('GET', '/', 'patient-a');
  assert.deepEqual({ id: before.body.profile.id, createdAt: before.body.profile.createdAt, version: before.body.profile.version },
    { id: 'profile-a', createdAt: '2026-01-01T00:00:00.000Z', version: 0 });
  assert.equal((await f.request('GET', '/', 'patient-b')).body.profile.id, 'profile-b');
  assert.deepEqual((await f.request('GET', '/', 'patient-new')).body, { profile: null });
  assert.equal((await f.request('POST', '/', 'patient-new', {})).status, 201);
  assert.equal((await f.request('POST', '/', 'patient-new', {})).status, 200);
  assert.equal((await f.request('PATCH', '/', 'patient-new', { expectedVersion: 0, weightKg: 1000 })).status, 200);
  assert.equal((await f.request('GET', '/', 'patient-new')).body.profile.weightKg, 1000);
  assert.equal((await f.request('PATCH', '/', 'patient-a', { expectedVersion: 0, injury: 'ankle sprain', weightKg: 72.4 })).status, 200);
  assert.deepEqual({ injury: (await f.request('GET', '/', 'patient-a')).body.profile.injury,
    weightKg: (await f.request('GET', '/', 'patient-a')).body.profile.weightKg }, { injury: 'ankle sprain', weightKg: 72.4 });
  assert.equal((await f.request('GET', '/', 'patient-b')).body.profile.injury, null);
  const audit = f.database.prepare('SELECT actor_user_id, action, patient_profile_id FROM patient_profile_audit WHERE patient_profile_id = ?').get('profile-a');
  assert.deepEqual(audit, { actor_user_id: 'patient-a', action: 'updated', patient_profile_id: 'profile-a' });
  assert.throws(() => f.database.prepare('DELETE FROM patient_profile_audit').run(), /immutable/);
});

test('physician requires active relationship, approval, fresh TOTP and live session on each access', async t => {
  const f = await fixture(t);
  const path = '/physician/profile-a';
  assert.equal((await f.request('GET', path, 'doctor-a')).status, 200);
  assert.equal((await f.request('GET', '/physician/profile-b', 'doctor-a')).status, 404);
  assert.equal((await f.request('PATCH', path, 'doctor-a', { expectedVersion: 0, injury: 'heel pain' })).status, 200);
  assert.deepEqual((await f.request('GET', path, 'doctor-a')).body.profile.lastChangedBy, { name: 'doctor-a' });
  assert.deepEqual((await f.request('GET', '/', 'patient-a')).body.profile.lastChangedBy, { name: 'doctor-a' });
  assert.equal((await f.request('PATCH', '/', 'patient-a', { expectedVersion: 1, injury: null })).status, 200);
  assert.deepEqual((await f.request('GET', path, 'doctor-a')).body.profile.lastChangedBy, { name: 'patient-a' });
  f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE id = 'relation-a'").run();
  assert.equal((await f.request('GET', path, 'doctor-a')).status, 404);
  f.database.prepare("INSERT INTO patient_invitation VALUES ('invite-switch', 'doctor-b', 'profile-a', 'patient-a', 'accepted', ?, ?)")
    .run(new Date().toISOString(), new Date(Date.now() + 60_000).toISOString());
  f.database.prepare(`INSERT INTO patient_relation (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
    VALUES ('relation-switch', 'doctor-b', 'profile-a', 'invite-switch', 'active', ?)`).run(new Date().toISOString());
  assert.equal((await f.request('GET', path, 'doctor-a')).status, 404);
  assert.equal((await f.request('GET', path, 'doctor-b')).status, 200);
  f.database.prepare("UPDATE physician_review_application SET status = 'revoked' WHERE account_user_id = 'doctor-b'").run();
  assert.equal((await f.request('GET', path, 'doctor-b')).status, 403);
  f.database.prepare("UPDATE physician_review_application SET status = 'approved' WHERE account_user_id = 'doctor-b'").run();
  f.database.prepare('UPDATE totp_step_up_attempt SET expires_at = ? WHERE user_id = ?').run(Date.now() - 1, 'doctor-b');
  assert.equal((await f.request('GET', path, 'doctor-b')).status, 403);
  f.database.prepare('UPDATE totp_step_up_attempt SET expires_at = ? WHERE user_id = ?').run(Date.now() + 30_000, 'doctor-b');
  f.database.prepare('UPDATE session SET expiresAt = ? WHERE userId = ?').run(new Date(Date.now() - 1).toISOString(), 'doctor-b');
  assert.equal((await f.request('GET', path, 'doctor-b')).status, 401);
  assert.equal((await f.request('GET', path, null)).status, 401);
});

test('profile inputs require exact keys, bounded values, origin and expectedVersion; concurrent writes conflict', async t => {
  const f = await fixture(t);
  for (const body of [
    { expectedVersion: 0, injury: '' }, { expectedVersion: 0, injury: 'x'.repeat(241) },
    { expectedVersion: 0, weightKg: 0 }, { expectedVersion: 0, weightKg: 1000.01 },
    { expectedVersion: 0, injury: 'ok', extra: 'no' }, { expectedVersion: 0 },
  ]) assert.equal((await f.request('PATCH', '/', 'patient-a', body)).status, 400);
  assert.equal((await f.request('PATCH', '/', 'patient-a', { expectedVersion: 0, injury: 'ok' }, { origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request('PATCH', '/', 'patient-a', { expectedVersion: 0, injury: 'ok' }, { origin: 'null' })).status, 403);
  const writes = await Promise.all([
    f.request('PATCH', '/', 'patient-a', { expectedVersion: 0, injury: 'one' }),
    f.request('PATCH', '/', 'patient-a', { expectedVersion: 0, injury: 'two' }),
  ]);
  assert.deepEqual(writes.map(result => result.status).sort(), [200, 409]);
  assert.equal(writes.find(result => result.status === 409).body.error, 'profile_changed');
  const count = f.database.prepare('SELECT count(*) AS count FROM patient_profile_audit').get().count;
  assert.equal(count, 1);
  assert.throws(() => f.database.prepare("UPDATE patient_profile_audit SET action = 'anything'").run(), /immutable/);
});

test('repeated profile migration preserves existing profile data and leaves optional fields empty', async t => {
  const f = await fixture(t);
  const before = f.database.prepare('SELECT id, account_user_id, created_at FROM patient_profile WHERE id = ?').get('profile-a');
  migratePatientProfiles(f.database);
  const after = f.database.prepare('SELECT id, account_user_id, created_at, injury, weight_kg, version FROM patient_profile WHERE id = ?').get('profile-a');
  assert.deepEqual({ id: after.id, account_user_id: after.account_user_id, created_at: after.created_at }, before);
  assert.deepEqual({ injury: after.injury, weight_kg: after.weight_kg, version: after.version }, { injury: null, weight_kg: null, version: 0 });
});

function legacyAuditDatabase({ failAfterRebuild = false } = {}) {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT, created_at TEXT);
    INSERT INTO user VALUES ('actor-a'), ('actor-b');
    INSERT INTO patient_profile VALUES ('profile-a', 'actor-a', '2026-01-01T00:00:00.000Z');
    INSERT INTO patient_profile VALUES ('profile-b', 'actor-b', '2026-01-01T00:00:00.000Z');
    CREATE TABLE patient_profile_audit (
      id TEXT PRIMARY KEY NOT NULL,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id),
      actor_user_id TEXT NOT NULL REFERENCES user(id),
      action TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    INSERT INTO patient_profile_audit VALUES
      ('audit-b', 'profile-a', 'actor-b', 'updated', '2026-01-02T00:00:00.000Z'),
      ('audit-a', 'profile-a', 'actor-a', 'updated', '2026-01-02T00:00:00.000Z'),
      ('audit-c', 'profile-a', 'actor-b', 'updated', '2026-01-03T00:00:00.000Z'),
      ('audit-other', 'profile-b', 'actor-a', 'updated', '2026-01-02T00:00:00.000Z');
    CREATE TRIGGER patient_profile_audit_no_update BEFORE UPDATE ON patient_profile_audit
      BEGIN SELECT RAISE(ABORT, 'legacy audit immutable'); END;
    CREATE TRIGGER patient_profile_audit_no_delete BEFORE DELETE ON patient_profile_audit
      BEGIN SELECT RAISE(ABORT, 'legacy audit immutable'); END;
    ${failAfterRebuild ? 'CREATE TABLE measurement_session (invalid_column TEXT);' : ''}
  `);
  return database;
}

test('legacy audit migration preserves rows and deterministically assigns per-profile versions despite immutable triggers', () => {
  const database = legacyAuditDatabase();
  try {
    migratePatientProfiles(database);
    migratePatientProfiles(database);
    assert.deepEqual(database.prepare(`SELECT id, patient_profile_id, actor_user_id, action, occurred_at, profile_version
      FROM patient_profile_audit ORDER BY patient_profile_id, profile_version`).all(), [
      { id: 'audit-a', patient_profile_id: 'profile-a', actor_user_id: 'actor-a', action: 'updated', occurred_at: '2026-01-02T00:00:00.000Z', profile_version: 1 },
      { id: 'audit-b', patient_profile_id: 'profile-a', actor_user_id: 'actor-b', action: 'updated', occurred_at: '2026-01-02T00:00:00.000Z', profile_version: 2 },
      { id: 'audit-c', patient_profile_id: 'profile-a', actor_user_id: 'actor-b', action: 'updated', occurred_at: '2026-01-03T00:00:00.000Z', profile_version: 3 },
      { id: 'audit-other', patient_profile_id: 'profile-b', actor_user_id: 'actor-a', action: 'updated', occurred_at: '2026-01-02T00:00:00.000Z', profile_version: 1 },
    ]);
    assert.throws(() => database.prepare("UPDATE patient_profile_audit SET action = 'changed'").run(), /immutable/);
    assert.throws(() => database.prepare('DELETE FROM patient_profile_audit').run(), /immutable/);
    assert.throws(() => database.prepare(`INSERT INTO patient_profile_audit
      (id, patient_profile_id, actor_user_id, action, occurred_at, profile_version)
      VALUES ('duplicate-version', 'profile-a', 'actor-a', 'updated', '2026-01-04T00:00:00.000Z', 2)`).run(), /UNIQUE/);
  } finally {
    database.close();
  }
});

test('partial legacy migration repairs duplicate default versions deterministically and is repeatable', () => {
  const database = legacyAuditDatabase();
  try {
    // Reproduce an interrupted/partial upgrade that added the column with a
    // constant default before a UNIQUE index could be created.
    database.exec('ALTER TABLE patient_profile_audit ADD COLUMN profile_version INTEGER NOT NULL DEFAULT 1 CHECK (profile_version > 0)');
    migratePatientProfiles(database);
    migratePatientProfiles(database);
    assert.deepEqual(database.prepare(`SELECT id, profile_version FROM patient_profile_audit
      WHERE patient_profile_id = 'profile-a' ORDER BY profile_version`).all(), [
      { id: 'audit-a', profile_version: 1 },
      { id: 'audit-b', profile_version: 2 },
      { id: 'audit-c', profile_version: 3 },
    ]);
    assert.equal(database.prepare('SELECT count(*) AS count FROM patient_profile_audit').get().count, 4);
    assert.throws(() => database.prepare("UPDATE patient_profile_audit SET action = 'changed'").run(), /immutable/);
    assert.throws(() => database.prepare('DELETE FROM patient_profile_audit').run(), /immutable/);
  } finally {
    database.close();
  }
});

test('legacy audit upgrade rolls back all profile and audit schema changes if a later migration step fails', () => {
  const database = legacyAuditDatabase({ failAfterRebuild: true });
  try {
    assert.throws(() => migratePatientProfiles(database), /no such column: patient_profile_id/);
    const auditColumns = database.prepare('PRAGMA table_info(patient_profile_audit)').all().map(column => column.name);
    assert.deepEqual(auditColumns, ['id', 'patient_profile_id', 'actor_user_id', 'action', 'occurred_at']);
    assert.equal(database.prepare('SELECT count(*) AS count FROM patient_profile_audit').get().count, 4);
    assert.deepEqual(database.prepare('PRAGMA table_info(patient_profile)').all().map(column => column.name),
      ['id', 'account_user_id', 'created_at']);
    assert.throws(() => database.prepare("UPDATE patient_profile_audit SET action = 'changed'").run(), /legacy audit immutable/);
  } finally {
    database.close();
  }
});
