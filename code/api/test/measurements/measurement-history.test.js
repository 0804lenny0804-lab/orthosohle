import assert from 'node:assert/strict';
import test from 'node:test';
import { account, cookies, fixture, signIn, signUp } from '../helpers/test-support.js';

const origin = 'http://127.0.0.1:5173';
const path = '/api/measurement-sessions/history';
const session = (id, hour, source = 'ble') => ({
  sessionId: id, source, startedAt: `2026-11-10T${hour}:00:00.000Z`, endedAt: `2026-11-10T${hour}:00:04.000Z`,
  intervals: [
    { timestamp: `2026-11-10T${hour}:00:00.000Z`, count: 2, avg: 2, max: 3 },
    { timestamp: `2026-11-10T${hour}:00:02.000Z`, count: 6, avg: 6, max: 8 },
  ],
});

test('history aggregates only owned completed sessions, retains gaps and pages bucket/session keys', async t => {
  const f = await fixture(t);
  const other = { ...account, email: 'other-history@example.invalid' };
  await signUp(f); await signUp(f, true, other);
  const own = cookies(await signIn(f)), foreign = cookies(await signIn(f, other.password, other));
  for (const cookie of [own, foreign]) assert.equal((await f.request('/api/patient-profile', { cookie, body: {}, origin })).status, 201);
  const entries = [session('10000000-0000-4000-8000-000000000001', '10'), session('10000000-0000-4000-8000-000000000002', '10', 'simulation'), session('10000000-0000-4000-8000-000000000003', '11')];
  for (const body of entries) assert.equal((await f.request('/api/measurement-sessions', { cookie: own, body, origin })).status, 201);
  assert.equal((await f.request('/api/measurement-sessions', { cookie: foreign, body: session('10000000-0000-4000-8000-000000000004', '10'), origin })).status, 201);
  const query = new URLSearchParams({ from: '2026-11-10T10:00:01.000Z', to: '2026-11-10T12:00:00.000Z', bucketSeconds: '60', limit: '1' });
  assert.equal((await f.request(`${path}?${query}`)).status, 401);
  const pages = [];
  do {
    const response = await f.request(`${path}?${query}`, { cookie: own });
    assert.equal(response.status, 200, `${query}: ${await response.clone().text()}`);
    const result = await response.json(); pages.push(...result.samples);
    if (!result.nextAfter) break;
    query.set('afterTime', result.nextAfter.timestamp); query.set('afterSessionId', result.nextAfter.sessionId);
  } while (pages.length < 10);
  assert.deepEqual(pages.map(row => row.sessionId), entries.map(entry => entry.sessionId));
  assert.equal(pages[0].count, 6); assert.equal(pages[1].source, 'simulation');
  query.set('from', '2026-11-10T10:00:00.000Z'); query.delete('afterTime'); query.delete('afterSessionId');
  const first = await (await f.request(`${path}?${query}`, { cookie: own })).json();
  assert.deepEqual(first.samples[0], { sessionId: entries[0].sessionId, source: 'ble', timestamp: '2026-11-10T10:00:00.000Z', firstAt: '2026-11-10T10:00:00.000Z', lastAt: '2026-11-10T10:00:02.000Z', count: 8, intervalCount: 2, missingSeconds: 1, avg: 5, max: 8 });
  query.set('to', '2026-11-10T10:00:02.000Z');
  const boundary = await (await f.request(`${path}?${query}`, { cookie: own })).json();
  assert.equal(boundary.samples[0].count, 2);
  assert.equal((await (await f.request(`${path}?${query}`, { cookie: foreign })).json()).samples[0].sessionId, '10000000-0000-4000-8000-000000000004');
});

test('history validates range, resolution, pagination and live patient session', async t => {
  const f = await fixture(t); await signUp(f); const cookie = cookies(await signIn(f));
  const valid = { from: '2026-11-01T00:00:00.000Z', to: '2026-12-01T00:00:00.000Z', bucketSeconds: '3600' };
  const url = values => `${path}?${new URLSearchParams(values)}`;
  assert.equal((await f.request(url(valid), { cookie })).status, 403);
  assert.equal((await f.request('/api/patient-profile', { cookie, body: {}, origin })).status, 201);
  for (const overrides of [{ from: '2026-13-01T00:00:00.000Z' }, { from: valid.to }, { to: '2022020' }, { to: '2027-01-01T00:00:00.000Z' }, { bucketSeconds: '60' }, { limit: '501' }, { limit: '0' }, { afterTime: valid.from }, { afterTime: valid.from, afterSessionId: 'bad' }, { afterTime: '2026-10-31T23:00:00.000Z', afterSessionId: '10000000-0000-4000-8000-000000000001' }, { unexpected: 'x' }]) assert.equal((await f.request(url({ ...valid, ...overrides }), { cookie })).status, 400);
  assert.deepEqual(await (await f.request(url(valid), { cookie })).json(), { samples: [], nextAfter: null });
  f.database.prepare('DELETE FROM session').run();
  assert.equal((await f.request(url(valid), { cookie })).status, 401);
});
