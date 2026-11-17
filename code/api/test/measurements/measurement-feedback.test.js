import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import Database from 'better-sqlite3';
import { createMeasurementFeedbackRouter } from '../../src/measurements/measurement-feedback-api.js';
import { migrateMeasurementFeedback } from '../../src/measurements/database-changes/measurement-feedback.js';

const ORIGIN = 'http://127.0.0.1:5173';
const patientId = '11111111-1111-4111-8111-111111111111';
const otherPatientId = '22222222-2222-4222-8222-222222222222';
const physicianId = '33333333-3333-4333-8333-333333333333';
const patientProfileId = '44444444-4444-4444-8444-444444444444';
const otherProfileId = '55555555-5555-4555-8555-555555555555';
const bleId = '66666666-6666-4666-8666-666666666666';
const simulatedId = '77777777-7777-4777-8777-777777777777';
const physicianSessionId = '88888888-8888-4888-8888-888888888888';
const activeBleId = '99999999-9999-4999-8999-999999999999';

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'measurement-feedback-'));
  const database = new Database(join(directory, 'feedback.sqlite'));
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, emailVerified INTEGER, twoFactorEnabled INTEGER);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT, token TEXT, expiresAt TEXT);
    CREATE TABLE twoFactor (userId TEXT, verified INTEGER);
    CREATE TABLE totp_step_up_attempt (user_id TEXT, session_id TEXT, verified_at INTEGER, expires_at INTEGER);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT);
    CREATE TABLE measurement_session (id TEXT PRIMARY KEY, patient_profile_id TEXT, source TEXT, status TEXT);
    CREATE TABLE physician_review_application (account_user_id TEXT, status TEXT);
    CREATE TABLE patient_relation (physician_user_id TEXT, patient_profile_id TEXT, status TEXT);
  `);
  database.prepare('INSERT INTO user VALUES (?, 1, 0)').run(patientId);
  database.prepare('INSERT INTO user VALUES (?, 1, 0)').run(otherPatientId);
  database.prepare('INSERT INTO user VALUES (?, 1, 1)').run(physicianId);
  database.prepare('INSERT INTO patient_profile VALUES (?, ?)').run(patientProfileId, patientId);
  database.prepare('INSERT INTO patient_profile VALUES (?, ?)').run(otherProfileId, otherPatientId);
  database.prepare('INSERT INTO measurement_session VALUES (?, ?, ?, ?)').run(bleId, patientProfileId, 'ble', 'completed');
  database.prepare('INSERT INTO measurement_session VALUES (?, ?, ?, ?)').run(simulatedId, patientProfileId, 'simulation', 'completed');
  database.prepare('INSERT INTO measurement_session VALUES (?, ?, ?, ?)').run(activeBleId, patientProfileId, 'ble', 'active');
  const future = new Date(Date.now() + 60_000).toISOString();
  database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run('patient-session', patientId, 'patient-token', future);
  database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run('other-session', otherPatientId, 'other-token', future);
  database.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run(physicianSessionId, physicianId, 'physician-token', future);
  database.prepare('INSERT INTO twoFactor VALUES (?, 1)').run(physicianId);
  database.prepare('INSERT INTO totp_step_up_attempt VALUES (?, ?, ?, ?)')
    .run(physicianId, physicianSessionId, Date.now(), Date.now() + 60_000);
  database.prepare('INSERT INTO physician_review_application VALUES (?, \'approved\')').run(physicianId);
  database.prepare('INSERT INTO patient_relation VALUES (?, ?, \'active\')').run(physicianId, patientProfileId);
  migrateMeasurementFeedback(database);
  migrateMeasurementFeedback(database);

  const users = {
    patient: { user: { id: patientId, emailVerified: true }, session: { id: 'patient-session', token: 'patient-token' } },
    other: { user: { id: otherPatientId, emailVerified: true }, session: { id: 'other-session', token: 'other-token' } },
    physician: { user: { id: physicianId, emailVerified: true }, session: { id: physicianSessionId, userId: physicianId, token: 'physician-token' } },
  };
  const auth = { api: { async getSession({ headers }) {
    const key = typeof headers?.get === 'function' ? headers.get('x-test-user') : headers?.['x-test-user'];
    return users[key] ?? null;
  } } };
  const app = express();
  app.use('/api/measurement-feedback', createMeasurementFeedbackRouter(auth, database, {
    webOrigin: ORIGIN,
    guards: { isPhysicianApprovedInTransaction: ({ user }) => user.id === physicianId &&
      database.prepare("SELECT 1 FROM physician_review_application WHERE account_user_id = ? AND status = 'approved'").get(user.id) !== undefined },
  }));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    database.close();
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    database,
    async request(path, { user = 'patient', body, method, origin = ORIGIN } = {}) {
      const requestMethod = method ?? (body === undefined ? 'GET' : 'POST');
      return fetch(`${base}/api/measurement-feedback${path}`, {
        method: requestMethod,
        headers: {
          'x-test-user': user,
          ...(body !== undefined ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    },
  };
}

test('patient feedback is optional, BLE-only, owner-bound, and safe against stale replay', async t => {
  const f = await setup(t);
  const path = `/${bleId}`;
  assert.deepEqual(await (await f.request(path)).json(), { feedback: null });
  assert.equal((await f.request(`/${simulatedId}`, { body: { rating: 'good', expectedVersion: null } })).status, 409);
  assert.equal((await f.request(`/${activeBleId}`, { body: { rating: 'good', expectedVersion: null } })).status, 409);
  assert.equal((await f.request(path, { user: 'other', body: { rating: 'good', expectedVersion: null } })).status, 404);

  const created = await f.request(path, { body: { rating: 'good', comment: '  synthetischer Kommentar  ', expectedVersion: null } });
  assert.equal(created.status, 201, await created.clone().text());
  const first = (await created.json()).feedback;
  assert.equal(first.comment, 'synthetischer Kommentar');
  assert.equal(first.version, 1);
  const replay = await f.request(path, { body: { rating: 'good', comment: 'synthetischer Kommentar', expectedVersion: null } });
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).feedback, first);

  const updated = await f.request(path, { body: { rating: 'medium', comment: null, expectedVersion: 1 } });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).feedback.version, 2);
  const stale = await f.request(path, { body: { rating: 'bad', expectedVersion: 1 } });
  assert.equal(stale.status, 409);
  assert.equal((await (await f.request(path)).json()).feedback.rating, 'medium');
  assert.equal((await f.request(path, { body: { rating: 'bad', expectedVersion: null } })).status, 409);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM measurement_feedback').get().n, 1);
});

test('physician feedback read requires active approved relation, fresh TOTP, and live session', async t => {
  const f = await setup(t);
  const patientPost = await f.request(`/${bleId}`, { body: { rating: 'bad', expectedVersion: null } });
  assert.equal(patientPost.status, 201);
  const path = `/physician/patients/${patientProfileId}/measurement-sessions/${bleId}`;
  const allowed = await f.request(path, { user: 'physician' });
  assert.equal(allowed.status, 200, await allowed.clone().text());
  assert.equal((await allowed.json()).feedback.rating, 'bad');
  assert.equal((await f.request(`/physician/patients/${otherProfileId}/measurement-sessions/${bleId}`, { user: 'physician' })).status, 404);
  assert.equal((await f.request(`/physician/patients/${patientProfileId}/measurement-sessions/${activeBleId}`, { user: 'physician' })).status, 404);
  f.database.prepare("UPDATE patient_relation SET status = 'ended'").run();
  assert.equal((await f.request(path, { user: 'physician' })).status, 404);
  f.database.prepare("UPDATE patient_relation SET status = 'active'").run();
  f.database.prepare('DELETE FROM totp_step_up_attempt').run();
  assert.equal((await f.request(path, { user: 'physician' })).status, 403);
  f.database.prepare('INSERT INTO totp_step_up_attempt VALUES (?, ?, ?, ?)')
    .run(physicianId, physicianSessionId, Date.now(), Date.now() + 60_000);
  f.database.prepare("UPDATE physician_review_application SET status = 'revoked'").run();
  assert.equal((await f.request(path, { user: 'physician' })).status, 403);
});

test('feedback input and origin are validated', async t => {
  const f = await setup(t);
  assert.equal((await f.request(`/${bleId}`, { body: { rating: 'okay', expectedVersion: null } })).status, 400);
  assert.equal((await f.request(`/${bleId}`, { body: { rating: 'good', expectedVersion: null, extra: true } })).status, 400);
  assert.equal((await f.request(`/${bleId}`, { body: { rating: 'good', expectedVersion: null, comment: 'x'.repeat(501) } })).status, 400);
  assert.equal((await f.request(`/${bleId}`, { origin: 'https://attacker.invalid', body: { rating: 'good', expectedVersion: null } })).status, 403);
});
