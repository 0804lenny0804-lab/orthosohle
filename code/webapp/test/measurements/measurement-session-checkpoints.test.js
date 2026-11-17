import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchActiveMeasurementSessions, uploadMeasurementCheckpoint } from '../../src/app-functions/measurements/measurement-session-api.js';

const activeSession = {
  id: 'synthetic-session', source: 'ble', startedAt: '2026-11-10T10:00:00.500Z',
  endedAt: '2026-11-10T10:00:02.000Z', sequence: 1,
  samples: [{ timestamp: '2026-11-10T10:00:00.000Z', count: 2, avg: 5, max: 8 }], gaps: [],
};

test('checkpoint requests use the authenticated checkpoint endpoint and preserve serialized payload', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ sequence: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const payload = {
    sessionId: 'synthetic-session', source: 'ble', startedAt: activeSession.startedAt,
    sequence: 1, checkpointAt: activeSession.endedAt, intervals: activeSession.samples, completed: false,
  };
  await uploadMeasurementCheckpoint(payload);
  assert.equal(calls[0].path, '/api/measurement-sessions/checkpoints');
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.equal(calls[0].options.credentials, 'same-origin');
});

test('completed BLE checkpoint sends only server fields and carries no UI feedback metadata', async (t) => {
  const originalFetch = globalThis.fetch;
  let sentBody;
  globalThis.fetch = async (_path, options) => {
    sentBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ session: { id: sentBody.sessionId } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const request = {
    sessionId: 'synthetic-session', source: 'ble', startedAt: activeSession.startedAt,
    sequence: 2, checkpointAt: '2026-11-10T10:00:03.000Z', intervals: [], completed: true,
    triggerFeedback: true, bleEpoch: 4,
  };
  await uploadMeasurementCheckpoint(request);
  assert.deepEqual(sentBody, {
    sessionId: request.sessionId, source: request.source, startedAt: request.startedAt,
    sequence: request.sequence, checkpointAt: request.checkpointAt, intervals: [], completed: true,
  });
});

test('active checkpoint recovery validates and returns the server confirmed samples and sequence', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/measurement-sessions/active');
    return new Response(JSON.stringify({ sessions: [activeSession] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  assert.deepEqual(await fetchActiveMeasurementSessions(), [activeSession]);
});

test('active checkpoint recovery rejects missing sequence metadata', async (t) => {
  const originalFetch = globalThis.fetch;
  const { sequence, ...invalidSession } = activeSession;
  globalThis.fetch = async () => new Response(JSON.stringify({ sessions: [invalidSession] }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
  t.after(() => { globalThis.fetch = originalFetch; });
  await assert.rejects(fetchActiveMeasurementSessions(), /ungültigen aktiven Sitzungsstand/);
});
