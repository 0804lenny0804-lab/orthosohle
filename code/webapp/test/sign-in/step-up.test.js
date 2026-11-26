import test from 'node:test';
import assert from 'node:assert/strict';
import { totpStepUpApi } from '../../src/app-functions/additional-totp-check/totp-api.js';
import { validStepUp } from '../../src/app-functions/additional-totp-check/totp-verification-state.js';

test('step-up state requires a server-issued session proof', () => {
  assert.equal(validStepUp({ verified: true, sessionBound: true }), true);
  assert.equal(validStepUp({ verified: true, sessionBound: false }), false);
  assert.equal(validStepUp({ verified: false, sessionBound: true }), false);
});

test('step-up API verifies TOTP and checks proof using the current cookie session', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await totpStepUpApi.verify('123456');
  await totpStepUpApi.check();

  assert.deepEqual(calls.map(call => call.path), ['/api/step-up/verify', '/api/step-up/guard']);
  assert.deepEqual(JSON.parse(calls[0].options.body), { code: '123456' });
  assert.deepEqual(JSON.parse(calls[1].options.body), {});
  assert.ok(calls.every(call => call.options.method === 'POST' && call.options.credentials === 'same-origin'));
});
