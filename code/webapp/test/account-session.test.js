import assert from 'node:assert/strict';
import test from 'node:test';
import { accountSession } from '../src/features/account/session.js';

test('expired profile writes clear identity and failed refresh cannot keep authenticated status', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const identity = { id: 'synthetic-a', name: 'Synthetic A', email: 'a@example.invalid', emailVerified: true };
  globalThis.fetch = async () => Response.json(identity);
  await accountSession.refresh();
  assert.equal(accountSession.state.status, 'authenticated');
  globalThis.fetch = async () => Response.json({}, { status: 401 });
  assert.equal(await accountSession.saveProfile('Changed'), false);
  assert.equal(accountSession.state.status, 'anonymous');
  assert.equal(accountSession.state.identityId, null);
  assert.equal(accountSession.state.name, '');
  globalThis.fetch = async () => Response.json(identity);
  await accountSession.refresh();
  globalThis.fetch = async () => Response.json({}, { status: 403 });
  assert.equal(await accountSession.refresh(), false);
  assert.equal(accountSession.state.status, 'unavailable');
  assert.equal(accountSession.state.identityId, null);
});

test('two-factor login waits for TOTP or recovery-code verification before loading identity', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  let verified = false;
  globalThis.fetch = async (path, options) => {
    calls.push({ path, body: options?.body ? JSON.parse(options.body) : null });
    if (path === '/api/auth/sign-in/email') return Response.json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
    if (path === '/api/auth/two-factor/verify-backup-code') {
      if (JSON.parse(options.body).code === 'invalid-recovery-code') {
        return Response.json({ code: 'INVALID_BACKUP_CODE' }, { status: 401 });
      }
      return Response.json({ token: 'synthetic-token' });
    }
    if (path === '/api/me') return verified
      ? Response.json({ id: 'synthetic-mfa', name: 'Synthetic MFA',
        email: 'mfa@example.invalid', emailVerified: true, twoFactorEnabled: true })
      : Response.json({}, { status: 401 });
    throw new Error(`Unexpected request: ${path}`);
  };

  await accountSession.refresh();
  const identityChecksBeforeLogin = calls.filter(call => call.path === '/api/me').length;
  const signIn = await accountSession.signIn({ email: 'mfa@example.invalid', password: 'Synthetic-password-42!' });
  assert.deepEqual(signIn, { requiresTwoFactor: true });
  assert.equal(accountSession.state.status, 'anonymous');
  assert.equal(accountSession.state.identityId, null);
  assert.equal(calls.filter(call => call.path === '/api/me').length, identityChecksBeforeLogin);

  verified = true;
  assert.equal(await accountSession.verifySignInBackupCode('invalid-recovery-code'), false);
  assert.equal(accountSession.state.identityId, null);
  assert.equal(await accountSession.verifySignInBackupCode('synthetic-recovery-code'), true);
  assert.equal(accountSession.state.identityId, 'synthetic-mfa');
  assert.equal(accountSession.state.twoFactorEnabled, true);
  assert.deepEqual(calls.filter(call => call.path.includes('two-factor/verify-backup-code')
      && call.body.code !== 'invalid-recovery-code').map(call => call.body), [
    { code: 'synthetic-recovery-code' },
  ]);
});

test('invalid TOTP enrollment code does not discard the authenticated session', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (path) => {
    if (path === '/api/me') return Response.json({ id: 'synthetic-enrollment', name: 'Synthetic Enrollment',
      email: 'enrollment@example.invalid', emailVerified: true, twoFactorEnabled: false });
    if (path === '/api/auth/two-factor/verify-totp') {
      return Response.json({ code: 'INVALID_CODE' }, { status: 401 });
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  await accountSession.refresh();
  assert.equal(accountSession.state.identityId, 'synthetic-enrollment');
  assert.equal(await accountSession.verifySignInCode('000000'), false);
  assert.equal(accountSession.state.status, 'authenticated');
  assert.equal(accountSession.state.identityId, 'synthetic-enrollment');
});
