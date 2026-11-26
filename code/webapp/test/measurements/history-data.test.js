import test from 'node:test';
import assert from 'node:assert/strict';
import { historyWindow, loadHistory, parseHistoryPage } from '../../src/app-functions/measurements/history/history-data.js';

const first = { sessionId: 'a', source: 'ble', timestamp: '2026-11-01T00:00:00.000Z', firstAt: '2026-11-01T00:00:01.000Z', lastAt: '2026-11-01T00:00:03.000Z', count: 2, intervalCount: 2, missingSeconds: 1, avg: 5, max: 8 };
test('window chooses bounded buckets for each period', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(historyWindow(1, now).bucketSeconds, 60);
  assert.equal(historyWindow(3, now).bucketSeconds, 900);
  assert.equal(historyWindow(7, now).bucketSeconds, 3600);
  assert.equal(historyWindow(30, now).from, '2026-10-21T12:00:00.000Z');
});
test('loads all pages and passes both cursor fields', async () => {
  const calls = [];
  const result = await loadHistory(historyWindow(1), () => true, async path => {
    calls.push(path);
    return calls.length === 1 ? { samples: [first], nextAfter: { timestamp: first.timestamp, sessionId: 'a' } } : { samples: [{ ...first, sessionId: 'b' }], nextAfter: null };
  });
  assert.equal(result.samples.length, 2);
  assert.equal(result.complete, true);
  assert.equal(new URL(calls[1], 'http://localhost').searchParams.get('afterSessionId'), 'a');
});
test('rejects invalid data and repeated cursors, and abandons stale requests', async () => {
  assert.throws(() => parseHistoryPage({ samples: [{ ...first, missingSeconds: -1 }], nextAfter: null }));
  await assert.rejects(loadHistory(historyWindow(1), () => true, async () => ({ samples: [first], nextAfter: { timestamp: first.timestamp, sessionId: 'a' } })), /vollständig/);
  assert.equal(await loadHistory(historyWindow(1), () => false, async () => ({ samples: [first], nextAfter: null })), null);
});
test('reports incomplete data instead of silently truncating', async () => {
  const result = await loadHistory(historyWindow(30), () => true, async () => ({ samples: Array.from({ length: 10000 }, (_, index) => ({ ...first, sessionId: String(index).padStart(5, '0') })), nextAfter: { timestamp: first.timestamp, sessionId: '09999' } }));
  assert.equal(result.complete, false);
});
