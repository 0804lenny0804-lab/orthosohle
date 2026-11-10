import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

async function fixture(t, { verificationExpiresIn = 3600, resetExpiresIn = 3600 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'orthosohle-auth-'));
  const secret = randomBytes(48).toString('base64url');
  let runtime;
  let server;
  let baseURL;
  async function stop() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    runtime?.close();
    runtime = undefined;
  }
  async function start(migrate = false) {
    server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseURL = `http://127.0.0.1:${server.address().port}`;
    const config = readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: secret,
      AUTH_BASE_URL: baseURL, AUTH_DATABASE_PATH: join(directory, 'auth.sqlite') });
    config.verificationExpiresIn = verificationExpiresIn;
    config.resetExpiresIn = resetExpiresIn;
    runtime = createAuth(config, { forMigration: migrate });
    if (migrate) {
      const { runMigrations } = await getMigrations(runtime.auth.options);
      await runMigrations();
      runtime.close();
      runtime = createAuth(config);
    }
    server.on('request', createApp(runtime.auth));
  }
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  await start(true);
  return {
    async restart() { await stop(); await start(); },
    async request(path, { cookie, body, origin = baseURL } = {}) {
      return fetch(`${baseURL}${path}`, { redirect: 'manual', method: body ? 'POST' : 'GET', headers: {
        ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
    },
    async mails() {
      const outbox = join(directory, 'auth.sqlite.mail-outbox');
      const names = await readdir(outbox);
      return Promise.all(names.map(async name => ({
        path: join(outbox, name),
        mail: JSON.parse(await readFile(join(outbox, name), 'utf8')),
      })));
    },
    get auth() { return runtime.auth; },
  };
}

const account = { name: 'Synthetic Test', email: 'synthetic@example.invalid', password: 'Synthetic-test-password-42!' };
function cookies(response) {
  const value = response.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  assert.ok(value.includes('session_token='));
  return value;
}
async function signUp(f, verify = true, user = account) {
  const response = await f.request('/api/auth/sign-up/email', { body: user });
  assert.equal(response.status, 200);
  const id = (await response.json()).user.id;
  if (verify) {
    const message = (await f.mails()).find(entry => entry.mail.to === user.email);
    assert.equal((await f.request(verificationPath(message.mail))).status, 200);
  }
  return id;
}
async function signIn(f, password = account.password, user = account) {
  return f.request('/api/auth/sign-in/email', { body: { email: user.email, password } });
}

test('profile name is session-owned, validated, and persists across restart', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Account A' };
  const userB = { ...account, name: 'Account B', email: 'second@example.invalid' };
  const idA = await signUp(f, true, userA);
  const idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));

  const updatePath = '/api/auth/update-user';
  assert.equal((await f.request(updatePath, { body: { name: '   ' }, cookie: cookieA })).status, 400);
  assert.equal((await f.request(updatePath, { body: { name: 'x'.repeat(101) }, cookie: cookieA })).status, 400);
  assert.equal((await f.request(updatePath, { body: { name: '   Renamed A   ', id: idB, userId: idB, role: 'admin' }, cookie: cookieA })).status, 200);
  assert.equal((await f.request(updatePath, { body: { name: 'Anonymous overwrite' } })).status, 401);
  const meA = await (await f.request('/api/me', { cookie: cookieA })).json();
  const meB = await (await f.request('/api/me', { cookie: cookieB })).json();
  assert.equal(meA.name, 'Renamed A');
  assert.equal(meB.id, idB);
  assert.equal(meB.name, 'Account B');

  assert.equal((await f.request(updatePath, { body: { name: 'Foreign overwrite' }, cookie: cookieA, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request('/api/auth/sign-out', { body: {}, cookie: cookieA })).status, 200);
  assert.equal((await f.request(updatePath, { body: { name: 'Replay overwrite' }, cookie: cookieA })).status, 401);
  await f.restart();
  assert.equal((await (await f.request('/api/me', { cookie: cookieA })).status), 401);
  const freshA = cookies(await signIn(f, userA.password, userA));
  assert.equal((await (await f.request('/api/me', { cookie: freshA })).json()).name, 'Renamed A');
  assert.equal((await (await f.request('/api/me', { cookie: cookieB })).json()).name, 'Account B');
});

test('loopback configuration requires opt-in, explicit secret and local URL', () => {
  assert.throws(() => readConfig({}), /LOCAL_AUTH_ENABLED/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true' }), /SECRET/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40),
    AUTH_BASE_URL: 'https://example.com' }), /loopback/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40),
    AUTH_WEB_ORIGIN: 'https://foreign.invalid' }), /AUTH_WEB_ORIGIN/);
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
  assert.deepEqual(await me.json(), { id, name: account.name, email: account.email, emailVerified: true });
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
  assert.deepEqual(await me.json(), { id, name: account.name, email: account.email, emailVerified: true });
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
  assert.deepEqual(await (await f.request('/api/me', { cookie })).json(), { id, name: account.name, email: account.email, emailVerified: true });
  assert.deepEqual(await (await f.request('/api/me', { cookie })).json(), { id, name: account.name, email: account.email, emailVerified: true });
  assert.equal((await f.request('/api/auth/sign-out', { body: {}, origin, cookie })).status, 200);
  assert.equal((await f.request('/api/me', { cookie })).status, 401);
});


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
  assert.deepEqual(Object.keys(me).sort(), ['email', 'emailVerified', 'id', 'name']);
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

test('server rejects blank names, malformed emails and short registration passwords', async t => {
  const f = await fixture(t);
  for (const body of [ { ...account, name: '  ' }, { ...account, email: 'not-an-email' }, { ...account, password: 'short' } ]) {
    assert.equal((await f.request('/api/auth/sign-up/email', { body })).status, 400);
  }
});
