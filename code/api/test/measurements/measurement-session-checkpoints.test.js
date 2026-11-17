import assert from 'node:assert/strict';
import test from 'node:test';
import { migratePatientProfiles } from '../../src/accounts/database-changes/patient-profile.js';
import { account, cookies, fixture, signIn, signUp } from '../helpers/test-support.js';

const ORIGIN = 'http://127.0.0.1:5173';
const SESSION_ID = '30000000-0000-4000-8000-000000000001';

function checkpoint(overrides = {}) {
  return {
    sessionId: SESSION_ID,
    source: 'ble',
    startedAt: '2026-11-10T10:00:00.000Z',
    sequence: 1,
    checkpointAt: '2026-11-10T10:00:02.000Z',
    completed: false,
    intervals: [
      { timestamp: '2026-11-10T10:00:00.000Z', count: 4, avg: 5, max: 8 },
      { timestamp: '2026-11-10T10:00:01.000Z', count: 3, avg: 4, max: 6 },
    ],
    ...overrides,
  };
}

async function revokeSessionAfterLookup(f, action) {
  const original = f.auth.api.getSession;
  f.auth.api.getSession = async (...args) => {
    const session = await original.call(f.auth.api, ...args);
    if (session?.session?.id) {
      f.database.prepare('DELETE FROM session WHERE id = ?').run(session.session.id);
    }
    return session;
  };
  try {
    return await action();
  } finally {
    f.auth.api.getSession = original;
  }
}

test('measurement checkpoints are owned, append-only, retryable, bounded, and hidden until complete', async t => {
  const f = await fixture(t);
  const patient = { ...account, name: 'Checkpoint Patient' };
  const foreignPatient = { ...account, name: 'Other Patient', email: 'checkpoint-other@example.invalid' };
  await signUp(f, true, patient);
  await signUp(f, true, foreignPatient);
  const patientCookie = cookies(await signIn(f, patient.password, patient));
  const foreignCookie = cookies(await signIn(f, foreignPatient.password, foreignPatient));
  const profiles = '/api/patient-profile';
  await f.request(profiles, { cookie: patientCookie, body: {}, origin: ORIGIN });
  await f.request(profiles, { cookie: foreignCookie, body: {}, origin: ORIGIN });
  const endpoint = '/api/measurement-sessions/checkpoints';
  const activePath = '/api/measurement-sessions/active';
  const first = checkpoint();

  assert.equal((await f.request(endpoint, { body: first, origin: ORIGIN })).status, 401);
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: first, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: first, contentType: 'text/plain', origin: ORIGIN })).status, 415);
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: first, origin: ORIGIN })).status, 201);
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: first, origin: ORIGIN })).status, 200);

  const active = await (await f.request(activePath, { cookie: patientCookie })).json();
  assert.equal(active.sessions.length, 1);
  assert.equal(active.sessions[0].sequence, 1);
  assert.equal((await (await f.request('/api/measurement-sessions', { cookie: patientCookie })).json()).sessions.length, 0);
  assert.equal((await f.request(`/api/measurement-sessions/${SESSION_ID}`, { cookie: patientCookie })).status, 404);
  assert.deepEqual((await (await f.request(activePath, { cookie: foreignCookie })).json()).sessions, []);
  await f.restart();
  assert.equal((await (await f.request(activePath, { cookie: patientCookie })).json()).sessions[0].sequence, 1);

  const gap = checkpoint({ sequence: 3, checkpointAt: '2026-11-10T10:00:04.000Z', intervals: [] });
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: gap, origin: ORIGIN })).status, 400);
  const validGap = checkpoint({ sequence: 3, checkpointAt: '2026-11-10T10:00:04.000Z', intervals: [
    { timestamp: '2026-11-10T10:00:03.000Z', count: 1, avg: 1, max: 1 },
  ] });
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: validGap, origin: ORIGIN })).status, 409);
  const alteredReplay = checkpoint({ intervals: [{ ...first.intervals[0], max: 9 }, first.intervals[1]] });
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: alteredReplay, origin: ORIGIN })).status, 409);
  assert.equal((await f.request(endpoint, { cookie: foreignCookie, body: checkpoint({ sequence: 2, completed: true, intervals: [] }), origin: ORIGIN })).status, 409);

  const second = checkpoint({
    sequence: 2,
    checkpointAt: '2026-11-10T10:00:04.000Z',
    completed: true,
    intervals: [{ timestamp: '2026-11-10T10:00:03.000Z', count: 2, avg: 3, max: 5 }],
  });
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: second, origin: ORIGIN })).status, 201);
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: second, origin: ORIGIN })).status, 200);
  assert.equal((await f.request(endpoint, { cookie: patientCookie, body: { ...second, intervals: [] }, origin: ORIGIN })).status, 409);
  assert.deepEqual((await (await f.request(activePath, { cookie: patientCookie })).json()).sessions, []);
  const history = await (await f.request('/api/measurement-sessions', { cookie: patientCookie })).json();
  assert.equal(history.sessions.length, 1);
  assert.deepEqual(history.sessions.map(session => session.id), [SESSION_ID]);
  const detail = await (await f.request(`/api/measurement-sessions/${SESSION_ID}`, { cookie: patientCookie })).json();
  assert.equal(detail.session.samples.length, 3);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_interval WHERE session_id = ?').get(SESSION_ID).count, 3);
  assert.equal(f.database.prepare('SELECT status FROM measurement_session WHERE id = ?').get(SESSION_ID).status, 'completed');
});

test('measurement checkpoints reject invalid bounds and oversized request chunks', async t => {
  const f = await fixture(t);
  await signUp(f);
  const cookie = cookies(await signIn(f));
  await f.request('/api/patient-profile', { cookie, body: {}, origin: ORIGIN });
  const endpoint = '/api/measurement-sessions/checkpoints';

  const invalid = [
    checkpoint({ sequence: 0 }),
    checkpoint({ checkpointAt: '2026-11-10T11:00:01.000Z' }),
    checkpoint({ intervals: [{ ...checkpoint().intervals[0], timestamp: '2026-11-10T10:00:03.000Z' }] }),
    checkpoint({ checkpointAt: '2026-11-10T10:01:01.000Z', intervals: Array.from({ length: 61 }, (_, index) => ({
      timestamp: new Date(Date.parse('2026-11-10T10:00:00.000Z') + index * 1000).toISOString(), count: 1, avg: 1, max: 1,
    })) }),
  ];
  for (const body of invalid) assert.equal((await f.request(endpoint, { cookie, body, origin: ORIGIN })).status, 400);
  assert.equal((await f.request(endpoint, { cookie, body: checkpoint({ intervals: [], completed: false }), origin: ORIGIN })).status, 400);
});

test('sequence 3601 completes exactly 3600 stored intervals with an empty terminal checkpoint', async t => {
  const f = await fixture(t);
  await signUp(f);
  const cookie = cookies(await signIn(f));
  const profile = (await (await f.request('/api/patient-profile', { cookie, body: {}, origin: ORIGIN })).json()).profile;
  const endpoint = '/api/measurement-sessions/checkpoints';
  const sessionId = '30000000-0000-4000-8000-000000000041';
  const startedAt = '2026-11-10T10:00:00.000Z';
  const start = Date.parse(startedAt);

  f.database.prepare(`INSERT INTO measurement_session
    (id, patient_profile_id, source, started_at, ended_at, payload_hash, status, checkpoint_sequence, checkpoint_hash, created_at)
    VALUES (?, ?, 'ble', ?, ?, 'seeded-hash', 'active', 3600, 'seeded-hash', ?)`)
    .run(sessionId, profile.id, startedAt, new Date(start + 3_600_000).toISOString(), new Date().toISOString());
  const insertInterval = f.database.prepare(`INSERT INTO measurement_interval
    (session_id, received_at, sample_count, average, maximum) VALUES (?, ?, 1, 1, 1)`);
  const seedIntervals = f.database.transaction(() => {
    for (let second = 0; second < 3600; second += 1) {
      insertInterval.run(sessionId, new Date(start + second * 1000).toISOString());
    }
  });
  seedIntervals();
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_interval WHERE session_id = ?').get(sessionId).count, 3600);

  const terminal = {
    sessionId,
    source: 'ble',
    startedAt,
    sequence: 3601,
    checkpointAt: new Date(start + 3_600_000).toISOString(),
    intervals: [],
    completed: true,
  };
  assert.equal((await f.request(endpoint, { cookie, body: terminal, origin: ORIGIN })).status, 201);
  assert.equal((await f.request(endpoint, { cookie, body: terminal, origin: ORIGIN })).status, 200);
  assert.equal((await f.request(endpoint, { cookie, body: { ...terminal, completed: false }, origin: ORIGIN })).status, 400);
  assert.equal((await f.request(endpoint, { cookie, body: {
    ...terminal,
    intervals: [{ timestamp: new Date(start + 3_599_000).toISOString(), count: 1, avg: 1, max: 1 }],
  }, origin: ORIGIN })).status, 400);
  assert.equal((await f.request(endpoint, { cookie, body: { ...terminal, sequence: 3602 }, origin: ORIGIN })).status, 400);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_interval WHERE session_id = ?').get(sessionId).count, 3600);
  assert.equal(f.database.prepare('SELECT status FROM measurement_session WHERE id = ?').get(sessionId).status, 'completed');
});

test('only one active session can be created per profile, including concurrent starts', async t => {
  const f = await fixture(t);
  await signUp(f);
  const cookie = cookies(await signIn(f));
  const profileResponse = await f.request('/api/patient-profile', { cookie, body: {}, origin: ORIGIN });
  const profileId = (await profileResponse.json()).profile.id;
  const endpoint = '/api/measurement-sessions/checkpoints';
  const firstId = '30000000-0000-4000-8000-000000000011';
  const secondId = '30000000-0000-4000-8000-000000000012';
  const starts = await Promise.all([
    f.request(endpoint, { cookie, body: checkpoint({ sessionId: firstId }), origin: ORIGIN }),
    f.request(endpoint, { cookie, body: checkpoint({ sessionId: secondId }), origin: ORIGIN }),
  ]);
  assert.deepEqual(starts.map(response => response.status).sort(), [201, 409]);
  assert.equal(f.database.prepare(`SELECT count(*) AS count FROM measurement_session
    WHERE patient_profile_id = ? AND status = 'active'`).get(profileId).count, 1);
});

test('existing multiple active rows are preserved and new starts remain blocked', async t => {
  const f = await fixture(t);
  await signUp(f);
  const cookie = cookies(await signIn(f));
  const profile = (await (await f.request('/api/patient-profile', { cookie, body: {}, origin: ORIGIN })).json()).profile;
  const first = checkpoint({ sessionId: '30000000-0000-4000-8000-000000000021' });
  assert.equal((await f.request('/api/measurement-sessions/checkpoints', { cookie, body: first, origin: ORIGIN })).status, 201);
  f.database.prepare(`INSERT INTO measurement_session
    (id, patient_profile_id, source, started_at, ended_at, payload_hash, status, checkpoint_sequence, checkpoint_hash, created_at)
    VALUES (?, ?, 'ble', ?, ?, 'legacy-hash', 'active', 1, 'legacy-hash', ?)`)
    .run('30000000-0000-4000-8000-000000000022', profile.id, first.startedAt, first.checkpointAt, new Date().toISOString());
  f.database.prepare('INSERT INTO measurement_interval VALUES (?, ?, 1, 1, 1)')
    .run('30000000-0000-4000-8000-000000000022', first.intervals[0].timestamp);
  migratePatientProfiles(f.database);
  migratePatientProfiles(f.database);

  const active = await (await f.request('/api/measurement-sessions/active', { cookie })).json();
  assert.equal(active.sessions.length, 2);
  const blocked = await f.request('/api/measurement-sessions/checkpoints', {
    cookie,
    body: checkpoint({ sessionId: '30000000-0000-4000-8000-000000000023' }),
    origin: ORIGIN,
  });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error, 'active_measurement_session_exists');
  assert.equal(f.database.prepare(`SELECT count(*) AS count FROM measurement_session
    WHERE patient_profile_id = ? AND status = 'active'`).get(profile.id).count, 2);
});

test('checkpoint writes and active reads recheck the live session inside their database transaction', async t => {
  const f = await fixture(t);
  const userA = { ...account, email: 'checkpoint-race-a@example.invalid' };
  const userB = { ...account, email: 'checkpoint-race-b@example.invalid' };
  await signUp(f, true, userA);
  await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));
  await f.request('/api/patient-profile', { cookie: cookieA, body: {}, origin: ORIGIN });
  await f.request('/api/patient-profile', { cookie: cookieB, body: {}, origin: ORIGIN });

  const activeRead = await revokeSessionAfterLookup(f, () => f.request('/api/measurement-sessions/active', { cookie: cookieA }));
  assert.equal(activeRead.status, 401);
  const checkpointWrite = await revokeSessionAfterLookup(f, () => f.request('/api/measurement-sessions/checkpoints', {
    cookie: cookieB,
    body: checkpoint({ sessionId: '30000000-0000-4000-8000-000000000031' }),
    origin: ORIGIN,
  }));
  assert.equal(checkpointWrite.status, 401);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_session').get().count, 0);
});
