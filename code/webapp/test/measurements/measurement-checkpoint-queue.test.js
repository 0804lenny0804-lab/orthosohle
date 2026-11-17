import assert from 'node:assert/strict';
import test from 'node:test';
import { drainMeasurementCheckpointQueue } from '../../src/app-functions/measurements/measurement-checkpoint-queue.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('a slow completed checkpoint ACK drains its rollover segment serially, including its final marker', async () => {
  const firstAck = deferred();
  const sessionA = {
    sessionId: 'synthetic-session-a', source: 'ble', startedAt: '2026-11-10T10:00:00.000Z',
    sequence: 1, checkpointAt: '2026-11-10T11:00:00.000Z', intervals: [], completed: true, bleEpoch: 4,
  };
  const sessionBInterval = {
    sessionId: 'synthetic-session-b', source: 'ble', startedAt: '2026-11-10T11:00:00.100Z',
    sequence: 1, checkpointAt: '2026-11-10T11:00:01.000Z', intervals: [
      { timestamp: '2026-11-10T11:00:00.000Z', count: 1, avg: 12, max: 12 },
    ], completed: false, bleEpoch: 4,
  };
  const sessionBComplete = {
    ...sessionBInterval, sequence: 2, checkpointAt: '2026-11-10T11:00:02.000Z', intervals: [],
    completed: true,
  };
  const current = {
    ownerIdentityId: 'synthetic-owner', checkpointQueue: [sessionA], uploading: false,
    checkpointSequence: 0, checkpointedIntervalCount: 0, sessionId: 'synthetic-session-a',
    startedAt: sessionA.startedAt, aggregator: {}, finalizing: true, error: '',
  };
  const calls = [];
  const emittedFeedback = [];
  let concurrentUploads = 0;
  let maximumConcurrentUploads = 0;

  const draining = drainMeasurementCheckpointQueue(current, {
    currentIdentityId: () => 'synthetic-owner',
    upload: async (chunk) => {
      calls.push(chunk.sessionId + ':' + chunk.sequence);
      concurrentUploads += 1;
      maximumConcurrentUploads = Math.max(maximumConcurrentUploads, concurrentUploads);
      if (chunk === sessionA) await firstAck.promise;
      concurrentUploads -= 1;
    },
    onAcknowledged: (chunk) => {
      if (chunk === sessionA) {
        current.sessionId = sessionBInterval.sessionId;
        current.startedAt = sessionBInterval.startedAt;
        current.aggregator = {};
        current.finalizing = true;
        current.checkpointSequence = 0;
        current.checkpointedIntervalCount = 0;
        current.checkpointQueue.push(sessionBInterval, sessionBComplete);
      } else if (chunk === sessionBComplete) {
        emittedFeedback.push(chunk.sessionId);
      }
    },
  });

  await Promise.resolve();
  assert.deepEqual(calls, ['synthetic-session-a:1']);
  const concurrentDrain = await drainMeasurementCheckpointQueue(current, {
    currentIdentityId: () => 'synthetic-owner', upload: async () => assert.fail('duplicate drain must not send'),
    onAcknowledged: () => assert.fail('duplicate drain must not acknowledge'),
  });
  assert.deepEqual(concurrentDrain, { sent: 0, pending: 1 });
  firstAck.resolve();
  const result = await draining;

  assert.deepEqual(calls, ['synthetic-session-a:1', 'synthetic-session-b:1', 'synthetic-session-b:2']);
  assert.equal(maximumConcurrentUploads, 1);
  assert.deepEqual(result, { sent: 3, pending: 0 });
  assert.deepEqual(emittedFeedback, ['synthetic-session-b']);
  assert.equal(current.uploading, false);
});

test('identity change during an in-flight ACK preserves later chunks without sending them to the new account', async () => {
  const firstAck = deferred();
  const current = {
    ownerIdentityId: 'synthetic-owner-a', checkpointQueue: [
      { sessionId: 'synthetic-a', sequence: 1, intervals: [], completed: false },
    ], uploading: false, checkpointSequence: 0, checkpointedIntervalCount: 0,
    sessionId: 'synthetic-a', startedAt: '2026-11-10T10:00:00.000Z', aggregator: {}, finalizing: false, error: '',
  };
  const sent = [];
  let identityId = 'synthetic-owner-a';
  const draining = drainMeasurementCheckpointQueue(current, {
    currentIdentityId: () => identityId,
    upload: async (chunk) => { sent.push(chunk.sessionId); await firstAck.promise; },
    onAcknowledged: () => current.checkpointQueue.push({ sessionId: 'synthetic-a', sequence: 2, intervals: [], completed: true }),
  });
  await Promise.resolve();
  identityId = 'synthetic-owner-b';
  firstAck.resolve();
  const result = await draining;
  assert.deepEqual(sent, ['synthetic-a']);
  assert.deepEqual(result, { sent: 1, pending: 1 });
  assert.match(current.error, /genau das Konto/);
  assert.equal(current.checkpointQueue[0].sequence, 2);
});
