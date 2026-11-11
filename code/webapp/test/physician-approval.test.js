import test from 'node:test';
import assert from 'node:assert/strict';
import { physicianApprovalApi } from '../src/features/physician-approval/approval-api.js';
import { consumePhysicianApprovalLink, isApprovalPreview, isApprovalResult } from '../src/features/physician-approval/approval-state.js';

test('approval callback accepts a fragment token and removes all approval URL material immediately', () => {
  const token = 'A'.repeat(43);
  const url = new URL(`https://app.example.invalid/account?keep=yes&physicianApproval=1#token=${token}`);
  const replaced = [];
  const result = consumePhysicianApprovalLink(url, path => replaced.push(path));
  assert.deepEqual(result, { present: true, token });
  assert.deepEqual(replaced, ['/account?keep=yes']);
  assert.deepEqual(consumePhysicianApprovalLink(url, () => assert.fail('should not replace')), { present: false, token: '' });
});

test('approval callback rejects malformed tokens and ignores unrelated fragments', () => {
  const malformed = new URL('https://app.example.invalid/?physicianApproval=1#token=not-a-token');
  const cleaned = [];
  assert.deepEqual(consumePhysicianApprovalLink(malformed, path => cleaned.push(path)), { present: true, token: '' });
  assert.deepEqual(cleaned, ['/']);
  const unrelated = new URL('https://app.example.invalid/?other=1#reset=secret');
  assert.deepEqual(consumePhysicianApprovalLink(unrelated, () => assert.fail('should not replace')), { present: false, token: '' });
  assert.equal(unrelated.hash, '#reset=secret');
});

test('approval preview and completion require explicit server states', () => {
  assert.equal(isApprovalPreview({ id: 'request-1', requestedAt: '2026-11-11T10:00:00Z', status: 'pending', email: 'doctor@example.invalid', name: null }), true);
  assert.equal(isApprovalPreview({ id: 'request-1', requestedAt: 'invalid', status: 'pending', email: 'doctor@example.invalid' }), false);
  assert.equal(isApprovalPreview({ id: 'request-1', requestedAt: '2026-11-11T10:00:00Z', status: 'pending' }), false);
  assert.equal(isApprovalResult({ id: 'request-1', status: 'approved' }), true);
  assert.equal(isApprovalResult({ id: 'request-1', status: 'pending' }), false);
});

test('approval client keeps TOTP and link credentials in POST bodies', async t => {
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

  await physicianApprovalApi.verifyTotp('123456');
  await physicianApprovalApi.reviewerStatus();
  await physicianApprovalApi.inspect('A'.repeat(43));
  await physicianApprovalApi.approve('A'.repeat(43));

  assert.deepEqual(calls.map(call => call.path), [
    '/api/step-up/verify',
    '/api/physician-review/approval',
    '/api/physician-review/approval/inspect',
    '/api/physician-review/approval/approve',
  ]);
  assert.equal(calls[1].options.method, 'GET');
  assert.deepEqual(JSON.parse(calls[0].options.body), { code: '123456' });
  assert.deepEqual(JSON.parse(calls[2].options.body), { token: 'A'.repeat(43) });
  assert.deepEqual(JSON.parse(calls[3].options.body), { token: 'A'.repeat(43) });
  assert.ok(calls.every(call => call.options.credentials === 'same-origin'));
});
