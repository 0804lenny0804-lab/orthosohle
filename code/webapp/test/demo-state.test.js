import assert from 'node:assert/strict';
import test from 'node:test';
import { clearLegacyDemoStorage, createDemoSessionState, legacyDemoStorageKeys } from '../src/features/demo/demo-state.js';

test('legacy shared demo keys are removed without clearing unrelated browser data', () => {
  const removed = [];
  clearLegacyDemoStorage({ removeItem: key => removed.push(key) });
  assert.deepEqual(removed, legacyDemoStorageKeys);
  assert.ok(removed.includes('orthosohle_current_run'));
  assert.ok(removed.includes('pwa__limit_user_1'));
  assert.ok(removed.includes('pwa__stepGoal_user_1'));
});

test('a demo session starts empty and without account ownership', () => {
  const state = createDemoSessionState();
  assert.deepEqual(state, {
    rawValues: [], measurements: [], limitHistory: [], stepCount: 0, stepGoal: 20, currentLimit: null,
  });
  assert.equal(Object.hasOwn(state, 'userId'), false);
});
