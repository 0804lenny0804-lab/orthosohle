import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { migratePatientProfiles } from '../../src/accounts/database-changes/patient-profile.js';
import { migrateTwoFactorSessions } from '../../src/sign-in/database-changes/two-factor-session.js';
import { account, cookies, fixture, signIn, signUp } from '../helpers/test-support.js';

const sampleSession = (sessionId, overrides = {}) => ({
  sessionId, source: 'ble', startedAt: '2026-11-10T10:00:00.000Z', endedAt: '2026-11-10T10:00:03.000Z',
  intervals: [
    { timestamp: '2026-11-10T10:00:00.000Z', count: 10, avg: 4.2, max: 8.1 },
    { timestamp: '2026-11-10T10:00:02.000Z', count: 7, avg: 3.8, max: 5.5 },
  ], ...overrides,
});

test('measurement sessions require verified profile, isolate two accounts, validate, deduplicate, and persist', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Session A' };
  const userB = { ...account, name: 'Session B', email: 'session-b@example.invalid' };
  const idA = await signUp(f, true, userA), idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));
  const path = '/api/measurement-sessions';
  const webOrigin = 'http://127.0.0.1:5173';
  assert.equal((await f.request(path, { body: sampleSession('10000000-0000-4000-8000-000000000001'), origin: webOrigin })).status, 401);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 403);
  assert.equal((await f.request('/api/patient-profile', { cookie: cookieA, body: {}, origin: webOrigin })).status, 201);
  assert.equal((await f.request('/api/patient-profile', { cookie: cookieB, body: {}, origin: webOrigin })).status, 201);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 200);
  assert.deepEqual(await (await f.request(path, { cookie: cookieA })).json(), { sessions: [], nextBefore: null });

  const good = sampleSession('10000000-0000-4000-8000-000000000001');
  assert.equal((await f.request(path, { cookie: cookieA, body: good, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: good, omitOrigin: true })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: good, contentType: 'text/plain', origin: webOrigin })).status, 415);
  assert.equal((await f.request(path, { cookie: cookieA, rawBody: '{', origin: webOrigin })).status, 400);
  const invalid = [
    { ...good, accountId: idB }, { ...good, profileId: 'foreign' }, { ...good, source: 'unknown' },
    { ...good, intervals: [...good.intervals].reverse() },
    { ...good, intervals: [{ ...good.intervals[0], max: 1 }, good.intervals[1]] },
    { ...good, endedAt: '2026-11-10T09:00:00.000Z' },
    { ...good, intervals: [{ ...good.intervals[0], timestamp: '2026-11-10T10:00:00.500Z' }, good.intervals[1]] },
    { ...good, intervals: Array.from({ length: 3601 }, (_, index) => ({ timestamp: new Date(Date.parse(good.startedAt) + index * 1000).toISOString(), count: 1, avg: 1, max: 1 })) },
  ];
  for (const body of invalid) assert.equal((await f.request(path, { cookie: cookieA, body, origin: webOrigin })).status, 400);

  const first = await f.request(path, { cookie: cookieA, body: good, origin: webOrigin });
  assert.equal(first.status, 201);
  const saved = (await first.json()).session;
  assert.equal(f.database.prepare('SELECT status FROM measurement_session WHERE id = ?').get(good.sessionId).status, 'completed');
  assert.deepEqual(saved.gaps, [{ from: good.intervals[0].timestamp, to: good.intervals[1].timestamp }]);
  assert.equal(saved.source, 'ble');
  const retry = await f.request(path, { cookie: cookieA, body: { ...good, intervals: good.intervals.map(item => ({ max: item.max, avg: item.avg, count: item.count, timestamp: item.timestamp })) }, origin: webOrigin });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).session.id, good.sessionId);
  assert.equal((await f.request(path, { cookie: cookieA, body: { ...good, source: 'simulation' }, origin: webOrigin })).status, 409);
  const ownHistory = await (await f.request(path, { cookie: cookieA })).json();
  const foreignHistory = await (await f.request(path, { cookie: cookieB })).json();
  assert.equal(ownHistory.sessions.length, 1);
  assert.deepEqual(foreignHistory, { sessions: [], nextBefore: null });
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_session').get().count, 1);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_interval').get().count, 2);
  assert.equal(idA, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = (SELECT patient_profile_id FROM measurement_session WHERE id = ?)').get(good.sessionId).account_user_id);
  const partialStart = sampleSession('10000000-0000-4000-8000-000000000002', {
    startedAt: '2026-11-10T10:00:00.650Z', endedAt: '2026-11-10T10:00:02.100Z',
    intervals: [
      { timestamp: '2026-11-10T10:00:00.000Z', count: 1, avg: 1, max: 1 },
      { timestamp: '2026-11-10T10:00:02.000Z', count: 1, avg: 1, max: 1 },
    ],
  });
  assert.equal((await f.request(path, { cookie: cookieA, body: partialStart, origin: webOrigin })).status, 201);
  assert.deepEqual((await (await f.request(`${path}/${partialStart.sessionId}`, { cookie: cookieA })).json()).session.samples,
    partialStart.intervals);
  assert.equal((await f.request(`${path}/${partialStart.sessionId}`, { cookie: cookieB })).status, 404);
  assert.equal((await f.request(`${path}?limit=0`, { cookie: cookieA })).status, 400);
  const page = await (await f.request(`${path}?limit=1`, { cookie: cookieA })).json();
  assert.equal(page.sessions.length, 1);
  assert.ok(page.nextBefore);

  await f.restart();
  const freshA = cookies(await signIn(f, userA.password, userA));
  const afterRestart = await (await f.request(path, { cookie: freshA })).json();
  assert.equal(afterRestart.sessions.length, 2);
  assert.deepEqual(afterRestart.sessions.map(item => item.id).sort(), [good.sessionId, partialStart.sessionId].sort());
  assert.deepEqual((await (await f.request(path, { cookie: cookieB })).json()).sessions, []);
});
test('profile name is session-owned, validated, and persists across restart', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Account A' };
  const userB = { ...account, name: 'Account B', email: 'second@example.invalid' };
  const idA = await signUp(f, true, userA);
  const idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));

  const updatePath = '/api/auth/update-user';
  assert.equal((await f.request(updatePath, { body: { name: '   ' }, cookie: cookieA })).status, 400);
  assert.equal((await f.request(updatePath, { body: { name: 'x'.repeat(101) }, cookie: cookieA })).status, 400);
  assert.equal((await f.request(updatePath, { body: { name: '   Renamed A   ', id: idB, userId: idB, role: 'admin' }, cookie: cookieA })).status, 200);
  assert.equal((await f.request(updatePath, { body: { name: 'Anonymous overwrite' } })).status, 401);
  const meA = await (await f.request('/api/me', { cookie: cookieA })).json();
  const meB = await (await f.request('/api/me', { cookie: cookieB })).json();
  assert.equal(meA.name, 'Renamed A');
  assert.equal(meB.id, idB);
  assert.equal(meB.name, 'Account B');

  assert.equal((await f.request(updatePath, { body: { name: 'Foreign overwrite' }, cookie: cookieA, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request('/api/auth/sign-out', { body: {}, cookie: cookieA })).status, 200);
  assert.equal((await f.request(updatePath, { body: { name: 'Replay overwrite' }, cookie: cookieA })).status, 401);
  await f.restart();
  assert.equal((await (await f.request('/api/me', { cookie: cookieA })).status), 401);
  const freshA = cookies(await signIn(f, userA.password, userA));
  assert.equal((await (await f.request('/api/me', { cookie: freshA })).json()).name, 'Renamed A');
  assert.equal((await (await f.request('/api/me', { cookie: cookieB })).json()).name, 'Account B');
});
test('patient profile belongs only to the verified account and survives restart', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Patient Account A' };
  const userB = { ...account, name: 'Patient Account B', email: 'patient-b@example.invalid' };
  const idA = await signUp(f, true, userA);
  const idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));
  const path = '/api/patient-profile';
  const webOrigin = 'http://127.0.0.1:5173';

  assert.equal((await f.request(path)).status, 401);
  assert.equal((await f.request(path, { body: {}, origin: webOrigin })).status, 401);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 200);
  assert.deepEqual(await (await f.request(path, { cookie: cookieA })).json(), { profile: null });

  for (const forgedBody of [
    { id: 'forged' }, { userId: idB }, { account_user_id: idB }, { role: 'admin' },
  ]) {
    assert.equal((await f.request(path, { cookie: cookieA, body: forgedBody, origin: webOrigin })).status, 400);
  }
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, omitOrigin: true })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin, contentType: 'text/plain' })).status, 415);
  assert.equal((await f.request(path, { cookie: cookieA, rawBody: '{', origin: webOrigin })).status, 400);

  // A previously valid session must lose profile access if verification is removed.
  f.database.prepare('UPDATE user SET emailVerified = 0 WHERE id = ?').run(idA);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin })).status, 403);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM patient_profile').get().count, 0);
  f.database.prepare('UPDATE user SET emailVerified = 1 WHERE id = ?').run(idA);

  const first = await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin });
  assert.equal(first.status, 201);
  const profileA = (await first.json()).profile;
  assert.match(profileA.id, /^[0-9a-f-]{36}$/i);
  assert.ok(profileA.createdAt);
  assert.deepEqual(Object.keys(profileA).sort(), ['createdAt', 'id', 'injury', 'lastChangedBy', 'updatedAt', 'version', 'weightKg']);
  const repeated = await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin });
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).profile, profileA);

  const accountBBefore = await f.request(path, { cookie: cookieB });
  assert.deepEqual(await accountBBefore.json(), { profile: null });
  const simultaneousCreates = await Promise.all([
    f.request(path, { cookie: cookieB, body: {}, origin: webOrigin }),
    f.request(path, { cookie: cookieB, body: {}, origin: webOrigin }),
  ]);
  assert.deepEqual(simultaneousCreates.map(response => response.status).sort(), [200, 201]);
  const profileB = (await simultaneousCreates[0].json()).profile;
  assert.deepEqual((await simultaneousCreates[1].json()).profile, profileB);
  assert.notEqual(profileB.id, profileA.id);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM patient_profile').get().count, 2);

  await f.request('/api/auth/sign-out', { cookie: cookieA, body: {}, origin: webOrigin });
  assert.equal((await f.request(path, { cookie: cookieA })).status, 401);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin })).status, 401);

  await f.restart();
  const freshA = cookies(await signIn(f, userA.password, userA));
  assert.deepEqual((await (await f.request(path, { cookie: freshA })).json()).profile, profileA);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 401);
  assert.equal(idA, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = ?').get(profileA.id).account_user_id);
  assert.equal(idB, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = ?').get(profileB.id).account_user_id);
});
test('patient profile migration is idempotent and keeps existing Better Auth users', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const before = f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId);
  const cookie = cookies(await signIn(f));
  // Reproduce upgrading an auth-only database containing an existing user/session.
  f.database.exec('DROP TABLE patient_profile');
  assert.throws(() => createApp(f.auth, { database: f.database, webOrigin: 'http://127.0.0.1:5173' }), /no such table: (main\.)?patient_profile/);
  migratePatientProfiles(f.database);
  migratePatientProfiles(f.database);
  assert.deepEqual(f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId), before);
  assert.equal((await (await f.request('/api/me', { cookie })).json()).id, userId);
  assert.throws(() => f.database.prepare('INSERT INTO patient_profile (id, account_user_id, created_at) VALUES (?, ?, ?)')
    .run('orphan', 'absent-user', new Date().toISOString()), /FOREIGN KEY/);

  const columns = f.database.prepare('PRAGMA table_info(patient_profile)').all();
  assert.deepEqual(columns.map(column => column.name), ['id', 'account_user_id', 'created_at', 'injury', 'weight_kg', 'version', 'updated_at']);
  const owner = columns.find(column => column.name === 'account_user_id');
  assert.equal(owner.notnull, 1);
  assert.ok(f.database.prepare("PRAGMA index_list('patient_profile')").all()
    .some(index => index.unique && f.database.prepare(`PRAGMA index_info('${index.name}')`).all()
      .some(column => column.name === 'account_user_id')));
  const foreignKey = f.database.prepare('PRAGMA foreign_key_list(patient_profile)').get();
  assert.equal(foreignKey.table, 'user');
  assert.equal(foreignKey.from, 'account_user_id');
  assert.equal(foreignKey.on_delete, 'RESTRICT');
  assert.equal(f.database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name LIKE '%role%'").get().count, 0);
});
test('measurement migration is idempotent and preserves existing user, session, and profile', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const profileResponse = await f.request('/api/patient-profile', { cookie: cookies(await signIn(f)), body: {}, origin: 'http://127.0.0.1:5173' });
  assert.equal(profileResponse.status, 201);
  const profile = (await profileResponse.json()).profile;
  const session = sampleSession('20000000-0000-4000-8000-000000000001');
  const cookie = cookies(await signIn(f));
  const endpoint = '/api/measurement-sessions';
  await f.request(endpoint, { cookie, body: session, origin: 'http://127.0.0.1:5173' });
  const userBefore = f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId);
  const sessionsBefore = f.database.prepare('SELECT count(*) AS count FROM session').get().count;
  f.database.exec('DROP TABLE measurement_interval; DROP TABLE measurement_session');
  migratePatientProfiles(f.database);
  migratePatientProfiles(f.database);
  assert.deepEqual(f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId), userBefore);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM session').get().count, sessionsBefore);
  assert.equal(f.database.prepare('SELECT id FROM patient_profile WHERE id = ?').get(profile.id).id, profile.id);
  assert.throws(() => f.database.prepare(`INSERT INTO measurement_session
    (id, patient_profile_id, source, started_at, ended_at, payload_hash, created_at)
    VALUES ('bad', 'absent-profile', 'ble', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 'hash', 'now')`).run(), /FOREIGN KEY/);
});
