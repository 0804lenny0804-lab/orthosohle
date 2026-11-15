import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { migratePatientProfiles } from '../../src/accounts/database-changes/patient-profile.js';
import { migrateTwoFactorSessions } from '../../src/sign-in/database-changes/two-factor-session.js';
import { account, cookies, fixture, signIn, signUp } from '../helpers/test-support.js';

function verificationPath(mail) {
  const url = new URL(mail.verificationURL);
  url.searchParams.delete('callbackURL');
  return `${url.pathname}${url.search}`;
}

test('local verification mail is private, verifiable once, and creates no session', async t => {
  const f = await fixture(t);
  await signUp(f, false);
  const [{ mail, path }] = await f.mails();
  assert.equal(mail.mode, 'LOCAL SYNTHETIC TEST MAIL — NOT SENT');
  assert.equal(new URL(mail.verificationURL).hostname, '127.0.0.1');
  assert.equal(new URL(mail.verificationURL).searchParams.get('callbackURL'), 'http://127.0.0.1:5173/#account');
  if (process.platform !== 'win32') {
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal((await stat(join(path, '..'))).mode & 0o777, 0o700);
  }
  const verified = await f.request(verificationPath(mail));
  assert.equal(verified.status, 200);
  assert.equal(verified.headers.get('set-cookie'), null);
  assert.equal(verified.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await f.request('/api/me')).status, 401);
  assert.equal((await f.request(verificationPath(mail))).status, 401);
  const cookie = cookies(await signIn(f));
  const me = await (await f.request('/api/me', { cookie })).json();
  assert.equal(me.emailVerified, true);
  assert.deepEqual(Object.keys(me).sort(), ['email', 'emailVerified', 'id', 'name', 'twoFactorEnabled']);
});
test('invalid and expired verification cannot change account status', async t => {
  const f = await fixture(t, { verificationExpiresIn: 1 });
  await signUp(f, false);
  const [{ mail }] = await f.mails();
  const bad = new URL(mail.verificationURL);
  bad.searchParams.delete('callbackURL');
  bad.searchParams.set('token', 'invalid-token');
  assert.equal((await f.request(`${bad.pathname}${bad.search}`)).status, 401);
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal((await f.request(verificationPath(mail))).status, 401);
  assert.equal((await signIn(f)).status, 403);
  const user = await (await f.auth.$context).internalAdapter.findUserByEmail(account.email);
  assert.equal(user.user.emailVerified, false);
});
test('resend stays private, callback is restricted and parallel replay succeeds only once', async t => {
  const f = await fixture(t);
  await signUp(f, false);
  assert.equal((await f.request('/api/auth/send-verification-email', {
    body: { email: account.email },
  })).status, 200);
  const mails = await f.mails();
  assert.equal(mails.length, 2);
  const path = verificationPath(mails[1].mail);
  assert.equal((await f.request(`${path}&callbackURL=${encodeURIComponent('https://foreign.invalid')}`)).status, 403);
  const result = await Promise.all([f.request(path), f.request(path)]);
  assert.deepEqual(result.map(r => r.status).sort(), [200, 401]);
  assert.equal((await f.request(path)).status, 401);
  const cookie = cookies(await signIn(f));
  assert.equal((await f.request('/api/auth/sign-out', { cookie, body: {} })).status, 200);
  assert.equal((await f.request('/api/me', { cookie })).status, 401);
});


async function resetMail(f) {
  const response = await f.request('/api/auth/request-password-reset', { body: { email: account.email } });
  assert.equal(response.status, 200);
  const messages = await f.mails();
  const { mail, path } = messages.find(entry => entry.mail.resetURL);
  const url = new URL(mail.resetURL);
  assert.equal(url.origin, 'http://127.0.0.1:5173');
  assert.equal(url.search, '');
  assert.ok(url.hash.startsWith('#account?reset='));
  return { token: new URLSearchParams(url.hash.split('?')[1]).get('reset'), path };
}
const newPassword = 'Synthetic-replacement-password-99!';
test('unverified registration cannot log in and repeated requests do not enumerate accounts', async t => {
  const f = await fixture(t);
  await signUp(f, false);
  const login = await signIn(f);
  assert.equal(login.status, 403);
  assert.equal(login.headers.get('set-cookie'), null);
  const known = await f.request('/api/auth/request-password-reset', { body: { email: account.email } });
  const unknown = await f.request('/api/auth/request-password-reset', { body: { email: 'absent@example.invalid' } });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(await known.json(), await unknown.json());
});
test('password reset revokes every old session and does not create a new one', async t => {
  const f = await fixture(t);
  await signUp(f);
  const first = cookies(await signIn(f));
  const second = cookies(await signIn(f));
  const { token, path } = await resetMail(f);
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600);
  const reset = await f.request('/api/auth/reset-password', { body: { token, newPassword } });
  assert.equal(reset.status, 200);
  assert.equal(reset.headers.get('set-cookie'), null);
  assert.equal((await f.request('/api/me', { cookie: first })).status, 401);
  assert.equal((await f.request('/api/me', { cookie: second })).status, 401);
  assert.equal((await signIn(f, newPassword)).status, 200);
});
test('reset validates password, rejects invalid/replayed tokens and replaces the old password', async t => {
  const f = await fixture(t);
  await signUp(f);
  const { token } = await resetMail(f);
  assert.equal((await f.request('/api/auth/reset-password', { body: { token: 'invalid', newPassword } })).status, 400);
  assert.equal((await f.request('/api/auth/reset-password', { body: { token, newPassword: 'short' } })).status, 400);
  assert.equal((await f.request('/api/auth/reset-password', { body: { token, newPassword } })).status, 200);
  assert.equal((await f.request('/api/auth/reset-password', { body: { token, newPassword } })).status, 400);
  assert.equal((await signIn(f)).status, 401);
  assert.equal((await signIn(f, newPassword)).status, 200);
});
test('expired reset cannot change password and callback destinations are fixed', async t => {
  const f = await fixture(t, { resetExpiresIn: 1 });
  await signUp(f);
  const { token } = await resetMail(f);
  assert.equal((await f.request('/api/auth/request-password-reset', {
    body: { email: account.email, redirectTo: 'http://127.0.0.1:5173/unapproved' },
  })).status, 403);
  assert.equal((await f.request(`/api/auth/reset-password/${token}?callbackURL=https://foreign.invalid`)).status, 403);
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal((await f.request('/api/auth/reset-password', { body: { token, newPassword } })).status, 400);
  assert.equal((await signIn(f)).status, 200);
  assert.equal((await signIn(f, newPassword)).status, 401);
});
