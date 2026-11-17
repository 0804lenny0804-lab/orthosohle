import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { migratePatientProfiles } from '../../src/accounts/database-changes/patient-profile.js';
import { migrateTwoFactorSessions } from '../../src/sign-in/database-changes/two-factor-session.js';
import { account, cookies, fixture, signIn, signUp } from '../helpers/test-support.js';

test('loopback configuration requires opt-in, explicit secret and local URL', () => {
  assert.throws(() => readConfig({}), /LOCAL_AUTH_ENABLED/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true' }), /SECRET/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40),
    AUTH_BASE_URL: 'https://example.com' }), /loopback/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40),
    AUTH_WEB_ORIGIN: 'https://foreign.invalid' }), /AUTH_WEB_ORIGIN/);
  assert.equal(readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40) }).physicianReviewNotifyEmail, null);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40),
    PHYSICIAN_REVIEW_NOTIFY_EMAIL: 'not an email' }), /PHYSICIAN_REVIEW_NOTIFY_EMAIL/);
});
test('login rejects foreign origin and normalizes account email', async t => {
  const f = await fixture(t);
  await signUp(f);
  const foreign = await f.request('/api/auth/sign-in/email', {
    body: { email: account.email, password: account.password }, origin: 'https://foreign.invalid',
  });
  assert.equal(foreign.status, 403);
  assert.equal((await signIn(f, 'wrong-password')).status, 401);
  const normalized = await f.request('/api/auth/sign-in/email', {
    body: { email: account.email.toUpperCase(), password: account.password },
  });
  assert.equal(normalized.status, 200);
  assert.equal((await f.request('/api/me', { cookie: cookies(normalized) })).status, 200);
});
test('malformed email login payload is rejected cleanly', async t => {
  const f = await fixture(t);
  await signUp(f);
  const malformed = await f.request('/api/auth/sign-in/email', {
    body: { email: { value: account.email }, password: account.password },
  });
  assert.equal(malformed.status, 400);
  assert.equal((await signIn(f)).status, 200);
});
test('registration, invalid login, valid session and replay after logout', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/me')).status, 401);
  const id = await signUp(f);
  assert.equal((await signIn(f, 'incorrect-password')).status, 401);
  const response = await signIn(f);
  assert.equal(response.status, 200);
  const cookie = cookies(response);
  const me = await f.request('/api/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await me.json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false, physicianApproved: false });
  assert.equal((await f.request('/api/auth/sign-out', { cookie, body: {} })).status, 200);
  assert.equal((await f.request('/api/me', { cookie })).status, 401);
  assert.equal(f.auth.options.session.cookieCache.enabled, false);
  assert.equal(f.auth.options.account.accountLinking.disableImplicitLinking, true);
});
test('account and session persist when server and SQLite connection reopen', async t => {
  const f = await fixture(t);
  const id = await signUp(f);
  const cookie = cookies(await signIn(f));
  await f.restart();
  const me = await f.request('/api/me', { cookie });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false, physicianApproved: false });
  const login = await signIn(f);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.id, id);
});
test('foreign origin cannot sign out an active session', async t => {
  const f = await fixture(t);
  await signUp(f);
  const cookie = cookies(await signIn(f));
  assert.equal((await f.request('/api/auth/sign-out', {
    cookie, body: {}, origin: 'https://foreign.invalid',
  })).status, 403);
  assert.equal((await f.request('/api/me', { cookie })).status, 200);
});
test('explicit local web origin can register, sign in, reload identity and sign out', async t => {
  const f = await fixture(t);
  const origin = 'http://127.0.0.1:5173';
  const registered = await f.request('/api/auth/sign-up/email', { body: account, origin });
  assert.equal(registered.status, 200);
  const id = (await registered.json()).user.id;
  const [{ mail }] = await f.mails();
  assert.equal((await f.request(verificationPath(mail))).status, 200);
  const login = await f.request('/api/auth/sign-in/email', {
    body: { email: account.email, password: account.password }, origin,
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.getSetCookie().join(';'), /HttpOnly/i);
  assert.match(login.headers.getSetCookie().join(';'), /SameSite=Lax/i);
  const cookie = cookies(login);
  assert.deepEqual(await (await f.request('/api/me', { cookie })).json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false, physicianApproved: false });
  assert.deepEqual(await (await f.request('/api/me', { cookie })).json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false, physicianApproved: false });
  assert.equal((await f.request('/api/auth/sign-out', { body: {}, origin, cookie })).status, 200);
  assert.equal((await f.request('/api/me', { cookie })).status, 401);
});


function verificationPath(mail) {
  const url = new URL(mail.verificationURL);
  url.searchParams.delete('callbackURL');
  return `${url.pathname}${url.search}`;
}
test('server rejects blank names, malformed emails and short registration passwords', async t => {
  const f = await fixture(t);
  for (const body of [ { ...account, name: '  ' }, { ...account, email: 'not-an-email' }, { ...account, password: 'short' } ]) {
    assert.equal((await f.request('/api/auth/sign-up/email', { body })).status, 400);
  }
});
