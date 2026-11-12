import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSecondAggregator,
  findReceiveGaps,
  draftForIdentity,
  getSessionEndTime,
  hasUnsavedDraftForOtherIdentity,
  isAtSessionLimit,
  MAX_SESSION_VALUE,
  MAX_SAMPLES_PER_INTERVAL,
  MAX_SESSION_DURATION_MS,
  MAX_SESSION_INTERVALS,
} from '../src/features/measurement/measurement-sessions.js';
import { parseSessionsResponse } from '../src/features/measurement/session-api.js';

test('aggregates only valid samples into UTC receive seconds with mean, maximum and count', () => {
  const aggregate = createSecondAggregator();
  assert.equal(aggregate.add(2, '2026-11-10T10:00:00.100Z'), true);
  assert.equal(aggregate.add(8, '2026-11-10T10:00:00.900Z'), true);
  assert.equal(aggregate.add(4, '2026-11-10T10:00:01.000Z'), true);
  assert.equal(aggregate.add(-1, '2026-11-10T10:00:01.100Z'), false);
  assert.equal(aggregate.add(MAX_SESSION_VALUE + 1, '2026-11-10T10:00:01.100Z'), false);
  assert.equal(aggregate.add(Number.NaN, '2026-11-10T10:00:02.100Z'), false);
  assert.deepEqual(aggregate.toIntervals(), [
    { timestamp: '2026-11-10T10:00:00.000Z', count: 2, avg: 5, max: 8 },
    { timestamp: '2026-11-10T10:00:01.000Z', count: 1, avg: 4, max: 4 },
  ]);
});

test('interval sample count does not exceed the API limit', () => {
  const aggregate = createSecondAggregator();
  for (let index = 0; index < MAX_SAMPLES_PER_INTERVAL; index += 1) {
    assert.equal(aggregate.add(1, '2026-11-10T10:00:00.000Z'), true);
  }
  assert.equal(aggregate.add(1, '2026-11-10T10:00:00.000Z'), false);
  assert.deepEqual(aggregate.toIntervals()[0], {
    timestamp: '2026-11-10T10:00:00.000Z', count: MAX_SAMPLES_PER_INTERVAL, avg: 1, max: 1,
  });
});

test('receive gaps describe missing intervals between saved seconds only', () => {
  assert.deepEqual(findReceiveGaps([
    { timestamp: '2026-11-10T10:00:03.000Z' },
    { timestamp: '2026-11-10T10:00:00.000Z' },
    { timestamp: '2026-11-10T10:00:01.000Z' },
  ]), [{ from: '2026-11-10T10:00:02.000Z', to: '2026-11-10T10:00:03.000Z' }]);
  assert.deepEqual(findReceiveGaps([{ timestamp: '2026-11-10T10:00:00.000Z' }]), []);
});

test('session caps apply to elapsed wall time and interval count, including empty receive periods', () => {
  const startedAt = '2026-11-10T10:00:00.500Z';
  assert.equal(isAtSessionLimit(startedAt, Date.parse(startedAt) + MAX_SESSION_DURATION_MS - 1, 0), false);
  assert.equal(isAtSessionLimit(startedAt, Date.parse(startedAt) + MAX_SESSION_DURATION_MS, 0), true);
  assert.equal(isAtSessionLimit(startedAt, Date.parse(startedAt) + 1, MAX_SESSION_INTERVALS - 1), false);
  assert.equal(isAtSessionLimit(startedAt, Date.parse(startedAt) + 1, MAX_SESSION_INTERVALS), true);
});

test('session end time is after start, includes the last receive second, and never exceeds one hour', () => {
  const startedAt = '2026-11-10T10:00:00.500Z';
  const intervals = [{ timestamp: '2026-11-10T10:00:00.000Z' }];
  assert.equal(getSessionEndTime(startedAt, Date.parse(startedAt), intervals), '2026-11-10T10:00:00.501Z');
  assert.equal(getSessionEndTime(startedAt, Date.parse(startedAt) + MAX_SESSION_DURATION_MS + 1000, intervals), '2026-11-10T11:00:00.500Z');
});

test('session response validation accepts list cursor and wrapped detail, rejects malformed aggregates', () => {
  const session = {
    id: 'synthetic-id', source: 'simulation', startedAt: '2026-11-10T10:00:00.500Z',
    endedAt: '2026-11-10T10:00:02.500Z',
    samples: [{ timestamp: '2026-11-10T10:00:00.000Z', count: 2, avg: 5, max: 8 }],
    gaps: [],
  };
  assert.deepEqual(parseSessionsResponse({ sessions: [session], nextBefore: { startedAt: session.startedAt, id: session.id } }), [session]);
  assert.throws(() => parseSessionsResponse({ sessions: [{ ...session, source: 'unknown' }] }));
  assert.throws(() => parseSessionsResponse({ sessions: [{ ...session, samples: [{ ...session.samples[0], count: 0 }] }] }));
});

test('pending measurement drafts stay isolated by account identity', () => {
  const first = draftForIdentity('synthetic-session-owner-a');
  const second = draftForIdentity('synthetic-session-owner-b');
  first.pendingPayload = { sessionId: 'synthetic-session-a', intervals: [{ count: 1 }] };
  assert.equal(second.pendingPayload, null);
  assert.equal(hasUnsavedDraftForOtherIdentity('synthetic-session-owner-b'), true);
  assert.equal(hasUnsavedDraftForOtherIdentity('synthetic-session-owner-a'), false);
  first.pendingPayload = null;
});
