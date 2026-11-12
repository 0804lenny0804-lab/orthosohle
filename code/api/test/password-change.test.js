import assert from 'node:assert/strict';
import test from 'node:test';
import { account, cookies, fixture, signIn, signUp } from './test-support.js';

const origin = 'http://127.0.0.1:5173';

test('Better Auth password change verifies current password, rotates own session, and revokes other sessions', async t => {
  const f = await fixture(t);
  await signUp(f, true);
  const current = cookies(await signIn(f));
  const other = cookies(await signIn(f));
  const path = '/api/auth/change-password';

  assert.equal((await f.request(path, { cookie: current, origin: 'https://foreign.invalid', body: {
    currentPassword: account.password, newPassword: 'New-synthetic-password-43!', revokeOtherSessions: true,
  } })).status, 403);
  const wrong = await f.request(path, { cookie: current, origin, body: {
    currentPassword: 'wrong-current-password', newPassword: 'New-synthetic-password-43!', revokeOtherSessions: true,
  } });
  assert.equal(wrong.status, 400);
  assert.equal((await f.request('/api/me', { cookie: current })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: other })).status, 200);

  const changed = await f.request(path, { cookie: current, origin, body: {
    currentPassword: account.password, newPassword: 'New-synthetic-password-43!', revokeOtherSessions: true,
  } });
  assert.equal(changed.status, 200);
  const retained = cookies(changed);
  assert.equal((await f.request('/api/me', { cookie: retained })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: current })).status, 401);
  assert.equal((await f.request('/api/me', { cookie: other })).status, 401);
  // Keep this focused test independent of Better Auth's shared per-path test bucket.
  f.database.prepare('DELETE FROM rateLimit').run();
  assert.equal((await signIn(f)).status, 401);
  f.database.prepare('DELETE FROM rateLimit').run();
  assert.equal((await signIn(f, 'New-synthetic-password-43!')).status, 200);
});
