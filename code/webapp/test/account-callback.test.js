import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeAccountCallback } from '../src/features/account/auth-api.js';

test('callback failures are consumed without exposing raw provider messages', () => {
  for (const query of ['error=TOKEN_EXPIRED', 'error=INVALID_TOKEN', 'verification=invalid', 'error=untrusted-text']) {
    const url = new URL(`http://127.0.0.1:5173/?${query}#account`);
    assert.deepEqual(consumeAccountCallback(url), { resetToken: '', linkError: true });
    assert.equal(url.href, 'http://127.0.0.1:5173/#account');
  }
});

test('reset tokens are consumed from the fragment and removed before requests', () => {
  const url = new URL('http://127.0.0.1:5173/#account?reset=synthetic-token-123');
  assert.deepEqual(consumeAccountCallback(url), { resetToken: 'synthetic-token-123', linkError: false });
  assert.equal(url.href, 'http://127.0.0.1:5173/#account');
  assert.equal(consumeAccountCallback(url).resetToken, '');
  const invalid = new URL('http://127.0.0.1:5173/#account?reset=%3Cunsafe%3E');
  assert.deepEqual(consumeAccountCallback(invalid), { resetToken: '', linkError: true });
  assert.equal(invalid.hash, '#account');
});
