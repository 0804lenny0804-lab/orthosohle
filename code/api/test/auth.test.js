import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

async function fixture(t) {
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
      return fetch(`${baseURL}${path}`, { method: body ? 'POST' : 'GET', headers: {
        ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
async function signUp(f) {
  const response = await f.request('/api/auth/sign-up/email', { body: account });
  assert.equal(response.status, 200);
  return (await response.json()).user.id;
}
async function signIn(f, password = account.password) {
  return f.request('/api/auth/sign-in/email', { body: { email: account.email, password } });
}

test('loopback configuration requires opt-in, explicit secret and local URL', () => {
  assert.throws(() => readConfig({}), /LOCAL_AUTH_ENABLED/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true' }), /SECRET/);
  assert.throws(() => readConfig({ LOCAL_AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: 'x'.repeat(40),
    AUTH_BASE_URL: 'https://example.com' }), /loopback/);
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
  assert.deepEqual(await me.json(), { id });
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
  assert.deepEqual(await me.json(), { id });
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
