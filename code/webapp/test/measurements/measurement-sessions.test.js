import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSecondAggregator,
  findReceiveGaps,
  getSessionEndTime,
  isAtSessionLimit,
  MAX_SESSION_VALUE,
  MAX_SAMPLES_PER_INTERVAL,
  MAX_SESSION_DURATION_MS,
  MAX_SESSION_INTERVALS,
  canAutoStartBleSession,
  completeBleCheckpointSegment,
  consumePendingBleSamples,
  MAX_PENDING_BLE_SAMPLES,
  queuePendingBleSample,
} from '../../src/app-functions/measurements/measurement-rules.js';
import { draftForIdentity, hasUnsavedDraftForOtherIdentity } from '../../src/app-functions/measurements/measurement-drafts.js';
import { parseSessionsResponse } from '../../src/app-functions/measurements/measurement-session-api.js';

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

test('automatic capture starts only for valid BLE samples with a ready profile and matching account', () => {
  const eligible = {
    source: 'ble', connected: true, profileReady: true,
    ownerIdentityId: 'synthetic-owner', identityId: 'synthetic-owner', active: false, pending: false,
  };
  assert.equal(canAutoStartBleSession(eligible), true);
  for (const change of [
    { source: 'simulation' }, { connected: false }, { profileReady: false },
    { ownerIdentityId: 'other-owner' }, { active: true }, { pending: true },
  ]) assert.equal(canAutoStartBleSession({ ...eligible, ...change }), false);
  assert.equal(canAutoStartBleSession({ ...eligible, identityId: '' }), false);
});

test('BLE samples received during a slow limit completion stay bounded and finish after disconnect ACK', () => {
  const draft = {
    ownerIdentityId: 'synthetic-owner',
    startedAt: '2026-11-10T10:00:00.000Z',
    aggregator: createSecondAggregator(),
    lastReceiveAt: '',
    rolloverSamples: [],
    rolloverOverflowSamples: 0,
    disconnectedBleEpochs: [7],
    feedbackRequestedSessionId: '',
    lastCompletedBleSessionId: '',
    lastCompletedBleEpoch: 0,
  };
  const queuedSample = {
    kg: 12, timestamp: '2026-11-10T11:00:01.250Z', source: 'ble',
    identityId: 'synthetic-owner', epoch: 7,
  };
  assert.equal(queuePendingBleSample(draft, queuedSample), true);

  const oldCompletion = completeBleCheckpointSegment(draft, 'synthetic-session-7', 7);
  assert.deepEqual(oldCompletion, { feedbackSessionId: '', continueRollover: true });

  draft.startedAt = queuedSample.timestamp;
  const resumed = consumePendingBleSamples(draft, 'synthetic-owner', 7);
  assert.deepEqual(resumed, { consumed: 1, drained: true });
  assert.equal(draft.aggregator.intervalCount, 1);
  const disconnectedFollowup = completeBleCheckpointSegment(draft, 'synthetic-session-7-followup', 7);
  assert.deepEqual(disconnectedFollowup, {
    feedbackSessionId: 'synthetic-session-7-followup', continueRollover: false,
  });
  assert.deepEqual(completeBleCheckpointSegment(draft, 'synthetic-session-7-followup', 7), {
    feedbackSessionId: '', continueRollover: false,
  });
});

test('BLE rollover preserves exact limit samples and keeps a later connection in its own segment', () => {
  const startedAt = '2026-11-10T10:00:00.000Z';
  const fullIntervals = Array.from({ length: MAX_SESSION_INTERVALS }, (_, index) => ({
    timestamp: new Date(Date.parse(startedAt) + index * 1000).toISOString(), count: 1, avg: 1, max: 1,
  }));
  const draft = {
    ownerIdentityId: 'synthetic-owner', startedAt,
    aggregator: createSecondAggregator(fullIntervals), lastReceiveAt: '',
    rolloverSamples: [], rolloverOverflowSamples: 0,
  };
  const limitSample = {
    kg: 9, timestamp: '2026-11-10T11:00:00.000Z', source: 'ble',
    identityId: 'synthetic-owner', epoch: 8,
  };
  assert.equal(queuePendingBleSample(draft, limitSample), true);
  assert.deepEqual(consumePendingBleSamples(draft, 'synthetic-owner', 8), { consumed: 0, reachedLimit: true });
  assert.equal(draft.rolloverSamples.length, 1);

  const newerConnectionSample = { ...limitSample, timestamp: '2026-11-10T11:00:01.100Z', epoch: 9 };
  assert.equal(queuePendingBleSample(draft, newerConnectionSample), true);
  assert.deepEqual(consumePendingBleSamples(draft, 'synthetic-owner', 8), { consumed: 0, reachedLimit: true });
  draft.aggregator = createSecondAggregator();
  draft.startedAt = limitSample.timestamp;
  assert.deepEqual(consumePendingBleSamples(draft, 'synthetic-owner', 8), { consumed: 1, nextEpoch: 9 });
  assert.equal(draft.rolloverSamples[0].epoch, 9);
  draft.aggregator = createSecondAggregator();
  draft.startedAt = newerConnectionSample.timestamp;
  assert.deepEqual(consumePendingBleSamples(draft, 'synthetic-owner', 9), { consumed: 1, drained: true });
  assert.equal(draft.rolloverSamples.length, 0);
});

test('a later BLE connection cannot delay or replace feedback for the disconnected session', () => {
  const draft = {
    ownerIdentityId: 'synthetic-owner', rolloverSamples: [
      { kg: 4, timestamp: '2026-11-10T11:00:01.000Z', source: 'ble', identityId: 'synthetic-owner', epoch: 12 },
    ],
    disconnectedBleEpochs: [11], feedbackRequestedSessionId: '',
  };
  const completed = completeBleCheckpointSegment(draft, 'disconnected-session', 11);
  assert.deepEqual(completed, { feedbackSessionId: 'disconnected-session', continueRollover: true });
  assert.equal(draft.rolloverSamples[0].epoch, 12);
  assert.deepEqual(completeBleCheckpointSegment(draft, 'disconnected-session', 11), {
    feedbackSessionId: '', continueRollover: true,
  });
});

test('BLE rollover buffer never silently replaces data on overflow or account mismatch', () => {
  const draft = {
    ownerIdentityId: 'synthetic-owner', rolloverSamples: [], rolloverOverflowSamples: 0,
  };
  for (let index = 0; index < MAX_PENDING_BLE_SAMPLES; index += 1) {
    assert.equal(queuePendingBleSample(draft, {
      kg: 1, timestamp: new Date(Date.UTC(2026, 10, 10) + index).toISOString(),
      source: 'ble', identityId: 'synthetic-owner', epoch: 1,
    }), true);
  }
  const first = draft.rolloverSamples[0];
  assert.equal(queuePendingBleSample(draft, {
    kg: 2, timestamp: '2026-11-10T10:00:00.000Z', source: 'ble', identityId: 'synthetic-owner', epoch: 1,
  }), false);
  assert.equal(draft.rolloverSamples.length, MAX_PENDING_BLE_SAMPLES);
  assert.equal(draft.rolloverSamples[0], first);
  assert.equal(draft.rolloverOverflowSamples, 1);
  assert.equal(queuePendingBleSample(draft, {
    kg: 3, timestamp: '2026-11-10T10:00:00.000Z', source: 'ble', identityId: 'other-owner', epoch: 2,
  }), false);
  assert.equal(draft.rolloverOverflowSamples, 1);
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
