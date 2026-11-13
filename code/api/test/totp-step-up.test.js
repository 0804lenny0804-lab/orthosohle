import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fixture, signUp, signIn, cookies, account } from './test-support.js';
import { createTotpStepUpRouter } from '../src/totp-step-up.js';
import { migrateTotpStepUp } from '../src/totp-step-up-migration.js';

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, buffer = 0;
  const bytes = [];
  for (const character of value.toUpperCase()) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid base32 test fixture');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) { bytes.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return String.fromCharCode(...bytes);
}

async function enableTotp(f) {
  const id = await signUp(f);
  const initialCookie = cookies(await signIn(f));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: initialCookie, body: { password: account.password, method: 'totp' },
  });
  const data = await setup.json();
  const secret = decodeBase32(new URL(data.totpURI).searchParams.get('secret'));
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const enabled = await f.request('/api/auth/two-factor/verify-totp', { cookie: initialCookie, body: { code } });
  assert.equal(enabled.status, 200);
  return { id, secret, cookie: cookies(enabled) };
}

async function mountRouter(t, f, auth = f.auth) {
  const server = createServer();
  const app = express();
  const webOrigin = 'http://web.example.invalid';
  migrateTotpStepUp(f.database);
  app.use('/step-up', createTotpStepUpRouter(auth, f.database, { webOrigin }));
  server.on('request', app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return async (path, cookie, body = {}) => fetch(`http://127.0.0.1:${server.address().port}/step-up/${path}`, {
    method: 'POST', headers: { Cookie: cookie, Origin: webOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('TOTP step-up creates a short-lived session-bound proof and guard fails closed', async t => {
  const f = await fixture(t);
  const { id, secret, cookie } = await enableTotp(f);
  const call = await mountRouter(t, f);
  assert.equal((await call('guard', cookie)).status, 403);
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const verified = await call('verify', cookie, { code });
  assert.equal(verified.status, 200, await verified.clone().text());
  assert.deepEqual(await verified.json(), { verified: true, expiresInSeconds: 300 });
  assert.equal((await call('guard', cookie)).status, 200);
  const stored = f.database.prepare('SELECT user_id, verified_at, expires_at FROM totp_step_up_attempt').get();
  assert.equal(stored.user_id, id);
  assert.ok(stored.expires_at > stored.verified_at);
  f.database.prepare('UPDATE totp_step_up_attempt SET expires_at = ? WHERE user_id = ?').run(Date.now() - 1, id);
  assert.equal((await call('guard', cookie)).status, 403);
});

test('step-up rejects disabled factors, revoked sessions, and rate-limit overflow', async t => {
  const f = await fixture(t);
  const { id, secret, cookie } = await enableTotp(f);
  const call = await mountRouter(t, f);
  for (let i = 0; i < 5; i++) assert.equal((await call('verify', cookie, { code: '000000' })).status, 401);
  assert.equal((await call('verify', cookie, { code: '000000' })).status, 429);
  const session = await f.auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
  f.database.prepare('DELETE FROM session WHERE id = ?').run(session.session.id);
  assert.equal((await call('guard', cookie)).status, 401);
  f.database.prepare('UPDATE user SET twoFactorEnabled = 0 WHERE id = ?').run(id);
  assert.equal(f.database.prepare('SELECT COUNT(*) AS count FROM totp_step_up_attempt WHERE user_id = ?').get(id).count, 0);
  // Isolate the disabled-factor assertion from the earlier account-wide limit.
  const nextCookie = cookies(await signIn(f));
  f.database.prepare('DELETE FROM totp_step_up_attempt WHERE user_id = ?').run(id);
  const valid = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  assert.equal((await call('verify', nextCookie, { code: valid })).status, 401);
});

test('factor replacement during an in-flight verification cannot mint a proof', async t => {
  const f = await fixture(t);
  const { id, cookie } = await enableTotp(f);
  let entered;
  const enteredVerifier = new Promise(resolve => { entered = resolve; });
  let release;
  const verifierGate = new Promise(resolve => { release = resolve; });
  const auth = { api: {
    getSession: options => f.auth.api.getSession(options),
    verifyTOTP: async options => {
      entered();
      await verifierGate;
      const current = await f.auth.api.getSession(options);
      return { token: current.session.token, user: { id } };
    },
  } };
  const call = await mountRouter(t, f, auth);
  const pending = call('verify', cookie, { code: '123456' });
  await enteredVerifier;
  f.database.prepare('UPDATE twoFactor SET secret = secret || ' + "'x'" + ' WHERE userId = ?').run(id);
  release();
  assert.equal((await pending).status, 401);
  assert.equal((await call('guard', cookie)).status, 403);
});

test('a later failed attempt invalidates an earlier in-flight success', async t => {
  const f = await fixture(t);
  const { id, cookie } = await enableTotp(f);
  let entered;
  const enteredVerifier = new Promise(resolve => { entered = resolve; });
  let release;
  const verifierGate = new Promise(resolve => { release = resolve; });
  const auth = { api: {
    getSession: options => f.auth.api.getSession(options),
    verifyTOTP: async options => {
      if (options.body.code === '111111') { entered(); await verifierGate; }
      else throw new Error('invalid code');
      const current = await f.auth.api.getSession(options);
      return { token: current.session.token, user: { id } };
    },
  } };
  const call = await mountRouter(t, f, auth);
  const earlierSuccess = call('verify', cookie, { code: '111111' });
  await enteredVerifier;
  assert.equal((await call('verify', cookie, { code: '222222' })).status, 401);
  release();
  assert.equal((await earlierSuccess).status, 401);
  assert.equal((await call('guard', cookie)).status, 403);
});
