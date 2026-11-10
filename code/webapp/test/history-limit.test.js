import assert from 'node:assert/strict';
import test from 'node:test';
import { limitForPeak } from '../src/components/history/limit-for-peak.js';

const limits = [
  { timestamp: '2026-11-10T10:00:00.000Z', limit_value: 30 },
  { timestamp: '2026-11-10T10:10:00.000Z', limit_value: 25 },
];

test('no configured or not-yet-effective limit is represented as absent', () => {
  assert.equal(limitForPeak([], '2026-11-10T10:05:00.000Z'), null);
  assert.equal(limitForPeak(limits, '2026-11-10T09:59:59.000Z'), null);
  assert.equal(limitForPeak(limits, 'invalid'), null);
});

test('a peak uses the latest limit that was already active at its timestamp', () => {
  assert.equal(limitForPeak(limits, '2026-11-10T10:05:00.000Z'), 30);
  assert.equal(limitForPeak(limits, '2026-11-10T10:15:00.000Z'), 25);
});
