import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { migratePatientProfiles } from '../../src/accounts/database-changes/patient-profile.js';
import { migrateTwoFactorSessions } from '../../src/sign-in/database-changes/two-factor-session.js';
import { account, cookies, fixture, signIn, signUp } from '../helpers/test-support.js';

test('TOTP setup requires a verified code; enabled login has no session until the real code succeeds', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const setupCookie = cookies(await signIn(f));
  const parallelSessionCookie = cookies(await signIn(f));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: setupCookie, body: { password: account.password, method: 'totp' },
  });
  assert.equal(setup.status, 200);
  const setupData = await setup.json();
  assert.equal(setupData.method, 'totp');
  assert.match(setupData.totpURI, /^otpauth:\/\/totp\//);
  assert.ok(setupData.backupCodes.length > 0);
  assert.equal(f.database.prepare('SELECT twoFactorEnabled FROM user WHERE id = ?').get(userId).twoFactorEnabled, 0);

  const secret = decodeBase32(new URL(setupData.totpURI).searchParams.get('secret'));
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const activated = await f.request('/api/auth/two-factor/verify-totp', { cookie: setupCookie, body: { code } });
  assert.equal(activated.status, 200, await activated.clone().text());
  assert.equal(f.database.prepare('SELECT twoFactorEnabled FROM user WHERE id = ?').get(userId).twoFactorEnabled, 1);
  assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM physician_session_proof').get().n, 0);
  const enabledCookie = cookies(activated);
  await f.restart();
  assert.equal((await f.request('/api/me', { cookie: enabledCookie })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: parallelSessionCookie })).status, 401);

  const login = await signIn(f);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).twoFactorRedirect, true);
  assert.doesNotMatch(login.headers.getSetCookie().join(';'), /session_token=[^;]/);
  assert.match(login.headers.getSetCookie().join(';'), /two_factor=/);
  const challengeCookie = login.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  assert.equal((await f.request('/api/me', { cookie: challengeCookie })).status, 401);
  const wrong = await f.request('/api/auth/two-factor/verify-totp', { cookie: challengeCookie, body: { code: '000000' } });
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).code, 'INVALID_CODE');
  assert.doesNotMatch(wrong.headers.getSetCookie().join(';'), /session_token=[^;]/);
  assert.equal((await f.request('/api/me', { cookie: challengeCookie })).status, 401);

  const validCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const verified = await f.request('/api/auth/two-factor/verify-totp', { cookie: challengeCookie, body: { code: validCode } });
  assert.equal(verified.status, 200);
  const loginCookie = cookies(verified);
  assert.equal((await f.request('/api/me', { cookie: loginCookie })).status, 200);
  assert.equal((await f.request('/api/step-up/guard', { cookie: loginCookie, body: {}, origin: 'http://127.0.0.1:5173' })).status, 200);
  assert.equal((await f.request('/api/auth/sign-out', { cookie: loginCookie, body: {} })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: loginCookie })).status, 401);
});
test('parallel second-factor sessions keep independent physician proofs after one logout', async t => {
  const f = await fixture(t);
  await signUp(f);
  const setupCookie = cookies(await signIn(f));
  const setup = await f.request('/api/auth/two-factor/enable', { cookie: setupCookie, body: { password: account.password, method: 'totp' } });
  const data = await setup.json();
  const secret = decodeBase32(new URL(data.totpURI).searchParams.get('secret'));
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  assert.equal((await f.request('/api/auth/two-factor/verify-totp', { cookie: setupCookie, body: { code } })).status, 200);
  const challengeA = await signIn(f);
  const loginA = await f.request('/api/auth/two-factor/verify-totp', { cookie: cookies(challengeA), body: { code } });
  assert.equal(loginA.status, 200);
  const challengeB = await signIn(f);
  const loginB = await f.request('/api/auth/two-factor/verify-backup-code', { cookie: cookies(challengeB), body: { code: data.backupCodes[0] } });
  assert.equal(loginB.status, 200);
  const cookieA = cookies(loginA), cookieB = cookies(loginB);
  const guard = cookie => f.request('/api/step-up/guard', { cookie, body: {}, origin: 'http://127.0.0.1:5173' });
  assert.equal((await guard(cookieA)).status, 200);
  assert.equal((await guard(cookieB)).status, 200);
  f.database.prepare('UPDATE physician_session_proof SET verified_at = ?').run(Date.now() - 60 * 60_000);
  assert.equal((await guard(cookieA)).status, 200);
  assert.equal((await f.request('/api/auth/sign-out', { cookie: cookieA, body: {} })).status, 200);
  assert.equal((await guard(cookieA)).status, 401);
  assert.equal((await guard(cookieB)).status, 200);
  f.database.prepare('UPDATE twoFactor SET verified = 0').run();
  assert.equal((await guard(cookieB)).status, 403);
});
test('a recovery code can finish login once and cannot be replayed', async t => {
  const f = await fixture(t);
  await signUp(f);
  const setupCookie = cookies(await signIn(f));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: setupCookie, body: { password: account.password, method: 'totp' },
  });
  const setupData = await setup.json();
  const secret = decodeBase32(new URL(setupData.totpURI).searchParams.get('secret'));
  const activationCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  assert.equal((await f.request('/api/auth/two-factor/verify-totp', {
    cookie: setupCookie, body: { code: activationCode },
  })).status, 200);

  const firstChallenge = await signIn(f);
  const firstLogin = await f.request('/api/auth/two-factor/verify-backup-code', {
    cookie: firstChallenge.headers.getSetCookie().map(line => line.split(';')[0]).join('; '),
    body: { code: setupData.backupCodes[0] },
  });
  assert.equal(firstLogin.status, 200);
  const firstSession = cookies(firstLogin);
  assert.equal((await f.request('/api/me', { cookie: firstSession })).status, 200);
  assert.equal((await f.request('/api/step-up/guard', { cookie: firstSession, body: {}, origin: 'http://127.0.0.1:5173' })).status, 200);
  await f.request('/api/auth/sign-out', { cookie: firstSession, body: {} });

  const secondChallenge = await signIn(f);
  const replay = await f.request('/api/auth/two-factor/verify-backup-code', {
    cookie: secondChallenge.headers.getSetCookie().map(line => line.split(';')[0]).join('; '),
    body: { code: setupData.backupCodes[0] },
  });
  assert.equal(replay.status, 401);
  assert.equal((await replay.json()).code, 'INVALID_BACKUP_CODE');
  assert.equal((await f.request('/api/me', { cookie: firstSession })).status, 401);
});
test('TOTP activation rolls back when atomic prior-session revocation fails', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const setupCookie = cookies(await signIn(f));
  const parallelCookie = cookies(await signIn(f));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: setupCookie, body: { password: account.password, method: 'totp' },
  });
  const setupData = await setup.json();
  const secret = decodeBase32(new URL(setupData.totpURI).searchParams.get('secret'));
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;

  migrateTwoFactorSessions(f.database);
  migrateTwoFactorSessions(f.database);
  f.database.exec(`CREATE TRIGGER fail_session_revocation BEFORE DELETE ON session
    BEGIN SELECT RAISE(ABORT, 'synthetic session deletion failure'); END`);
  const invalidCode = code === '000000' ? '000001' : '000000';
  const invalid = await f.request('/api/auth/two-factor/verify-totp', {
    cookie: setupCookie, body: { code: invalidCode },
  });
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json()).code, 'INVALID_CODE');
  assert.equal(f.database.prepare('SELECT twoFactorEnabled FROM user WHERE id = ?').get(userId).twoFactorEnabled, 0);
  const response = await f.request('/api/auth/two-factor/verify-totp', { cookie: setupCookie, body: { code } });
  assert.equal(response.status, 500);
  assert.equal(f.database.prepare('SELECT twoFactorEnabled FROM user WHERE id = ?').get(userId).twoFactorEnabled, 0);
  assert.equal(f.database.prepare('SELECT verified FROM twoFactor WHERE userId = ?').get(userId).verified, 0);
  assert.equal((await f.request('/api/me', { cookie: setupCookie })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: parallelCookie })).status, 200);
  f.database.exec('DROP TRIGGER fail_session_revocation');
  const retry = await f.request('/api/auth/two-factor/verify-totp', { cookie: setupCookie, body: { code } });
  assert.equal(retry.status, 200);
  assert.equal(f.database.prepare('SELECT twoFactorEnabled FROM user WHERE id = ?').get(userId).twoFactorEnabled, 1);
  assert.equal((await f.request('/api/me', { cookie: setupCookie })).status, 401);
  assert.equal((await f.request('/api/me', { cookie: parallelCookie })).status, 401);
});
test('concurrent password sign-in and TOTP activation cannot retain a password-only session', async t => {
  const f = await fixture(t);
  await signUp(f);
  const setupCookie = cookies(await signIn(f));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: setupCookie, body: { password: account.password, method: 'totp' },
  });
  const setupData = await setup.json();
  const secret = decodeBase32(new URL(setupData.totpURI).searchParams.get('secret'));
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;

  const loginPromise = signIn(f);
  const activationPromise = f.request('/api/auth/two-factor/verify-totp', {
    cookie: setupCookie, body: { code },
  });
  const [login, activated] = await Promise.all([loginPromise, activationPromise]);
  assert.equal(activated.status, 200);
  assert.equal(f.database.prepare('SELECT twoFactorEnabled FROM user WHERE email = ?').get(account.email).twoFactorEnabled, 1);

  if (login.status === 401) {
    assert.equal((await login.json()).code, 'TWO_FACTOR_REQUIRED');
    assert.doesNotMatch(login.headers.getSetCookie().join(';'), /session_token=[^;]/);
  } else {
    assert.equal(login.status, 200);
    assert.equal((await login.json()).twoFactorRedirect, true);
    assert.doesNotMatch(login.headers.getSetCookie().join(';'), /session_token=[^;]/);
  }
  const loginCookie = login.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  assert.equal((await f.request('/api/me', { cookie: loginCookie })).status, 401);
});

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const bytes = [];
  for (const character of value.toUpperCase()) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid base32 test fixture');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return String.fromCharCode(...bytes);
}
