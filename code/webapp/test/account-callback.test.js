import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeVerificationError } from '../src/features/account/auth-api.js';

test('verification callbacks consume library errors and local rejection without showing raw values', () => {
  for (const query of ['error=TOKEN_EXPIRED', 'error=INVALID_TOKEN', 'verification=invalid', 'error=untrusted-text']) {
    const url = new URL(`http://127.0.0.1:5173/?${query}#account`);
    assert.equal(consumeVerificationError(url), true);
    assert.equal(url.href, 'http://127.0.0.1:5173/#account');
  }
  const success = new URL('http://127.0.0.1:5173/#account');
  assert.equal(consumeVerificationError(success), false);
});
