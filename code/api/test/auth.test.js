import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { migratePatientProfiles } from '../src/patient-profile-migration.js';
import { migrateTwoFactorSessions } from '../src/two-factor-session-migration.js';
import { account, cookies, fixture, signIn, signUp } from './test-support.js';

const sampleSession = (sessionId, overrides = {}) => ({
  sessionId, source: 'ble', startedAt: '2026-11-10T10:00:00.000Z', endedAt: '2026-11-10T10:00:03.000Z',
  intervals: [
    { timestamp: '2026-11-10T10:00:00.000Z', count: 10, avg: 4.2, max: 8.1 },
    { timestamp: '2026-11-10T10:00:02.000Z', count: 7, avg: 3.8, max: 5.5 },
  ], ...overrides,
});

test('measurement sessions require verified profile, isolate two accounts, validate, deduplicate, and persist', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Session A' };
  const userB = { ...account, name: 'Session B', email: 'session-b@example.invalid' };
  const idA = await signUp(f, true, userA), idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));
  const path = '/api/measurement-sessions';
  const webOrigin = 'http://127.0.0.1:5173';
  assert.equal((await f.request(path, { body: sampleSession('10000000-0000-4000-8000-000000000001'), origin: webOrigin })).status, 401);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 403);
  assert.equal((await f.request('/api/patient-profile', { cookie: cookieA, body: {}, origin: webOrigin })).status, 201);
  assert.equal((await f.request('/api/patient-profile', { cookie: cookieB, body: {}, origin: webOrigin })).status, 201);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 200);
  assert.deepEqual(await (await f.request(path, { cookie: cookieA })).json(), { sessions: [], nextBefore: null });

  const good = sampleSession('10000000-0000-4000-8000-000000000001');
  assert.equal((await f.request(path, { cookie: cookieA, body: good, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: good, omitOrigin: true })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: good, contentType: 'text/plain', origin: webOrigin })).status, 415);
  assert.equal((await f.request(path, { cookie: cookieA, rawBody: '{', origin: webOrigin })).status, 400);
  const invalid = [
    { ...good, accountId: idB }, { ...good, profileId: 'foreign' }, { ...good, source: 'unknown' },
    { ...good, intervals: [...good.intervals].reverse() },
    { ...good, intervals: [{ ...good.intervals[0], max: 1 }, good.intervals[1]] },
    { ...good, endedAt: '2026-11-10T09:00:00.000Z' },
    { ...good, intervals: [{ ...good.intervals[0], timestamp: '2026-11-10T10:00:00.500Z' }, good.intervals[1]] },
    { ...good, intervals: Array.from({ length: 3601 }, (_, index) => ({ timestamp: new Date(Date.parse(good.startedAt) + index * 1000).toISOString(), count: 1, avg: 1, max: 1 })) },
  ];
  for (const body of invalid) assert.equal((await f.request(path, { cookie: cookieA, body, origin: webOrigin })).status, 400);

  const first = await f.request(path, { cookie: cookieA, body: good, origin: webOrigin });
  assert.equal(first.status, 201);
  const saved = (await first.json()).session;
  assert.deepEqual(saved.gaps, [{ from: good.intervals[0].timestamp, to: good.intervals[1].timestamp }]);
  assert.equal(saved.source, 'ble');
  const retry = await f.request(path, { cookie: cookieA, body: { ...good, intervals: good.intervals.map(item => ({ max: item.max, avg: item.avg, count: item.count, timestamp: item.timestamp })) }, origin: webOrigin });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).session.id, good.sessionId);
  assert.equal((await f.request(path, { cookie: cookieA, body: { ...good, source: 'simulation' }, origin: webOrigin })).status, 409);
  const ownHistory = await (await f.request(path, { cookie: cookieA })).json();
  const foreignHistory = await (await f.request(path, { cookie: cookieB })).json();
  assert.equal(ownHistory.sessions.length, 1);
  assert.deepEqual(foreignHistory, { sessions: [], nextBefore: null });
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_session').get().count, 1);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM measurement_interval').get().count, 2);
  assert.equal(idA, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = (SELECT patient_profile_id FROM measurement_session WHERE id = ?)').get(good.sessionId).account_user_id);
  const partialStart = sampleSession('10000000-0000-4000-8000-000000000002', {
    startedAt: '2026-11-10T10:00:00.650Z', endedAt: '2026-11-10T10:00:02.100Z',
    intervals: [
      { timestamp: '2026-11-10T10:00:00.000Z', count: 1, avg: 1, max: 1 },
      { timestamp: '2026-11-10T10:00:02.000Z', count: 1, avg: 1, max: 1 },
    ],
  });
  assert.equal((await f.request(path, { cookie: cookieA, body: partialStart, origin: webOrigin })).status, 201);
  assert.deepEqual((await (await f.request(`${path}/${partialStart.sessionId}`, { cookie: cookieA })).json()).session.samples,
    partialStart.intervals);
  assert.equal((await f.request(`${path}/${partialStart.sessionId}`, { cookie: cookieB })).status, 404);
  assert.equal((await f.request(`${path}?limit=0`, { cookie: cookieA })).status, 400);
  const page = await (await f.request(`${path}?limit=1`, { cookie: cookieA })).json();
  assert.equal(page.sessions.length, 1);
  assert.ok(page.nextBefore);

  await f.restart();
  const freshA = cookies(await signIn(f, userA.password, userA));
  const afterRestart = await (await f.request(path, { cookie: freshA })).json();
  assert.equal(afterRestart.sessions.length, 2);
  assert.deepEqual(afterRestart.sessions.map(item => item.id).sort(), [good.sessionId, partialStart.sessionId].sort());
  assert.deepEqual((await (await f.request(path, { cookie: cookieB })).json()).sessions, []);
});

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

test('patient profile belongs only to the verified account and survives restart', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Patient Account A' };
  const userB = { ...account, name: 'Patient Account B', email: 'patient-b@example.invalid' };
  const idA = await signUp(f, true, userA);
  const idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));
  const path = '/api/patient-profile';
  const webOrigin = 'http://127.0.0.1:5173';

  assert.equal((await f.request(path)).status, 401);
  assert.equal((await f.request(path, { body: {}, origin: webOrigin })).status, 401);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 200);
  assert.deepEqual(await (await f.request(path, { cookie: cookieA })).json(), { profile: null });

  for (const forgedBody of [
    { id: 'forged' }, { userId: idB }, { account_user_id: idB }, { role: 'admin' },
  ]) {
    assert.equal((await f.request(path, { cookie: cookieA, body: forgedBody, origin: webOrigin })).status, 400);
  }
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, omitOrigin: true })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin, contentType: 'text/plain' })).status, 415);
  assert.equal((await f.request(path, { cookie: cookieA, rawBody: '{', origin: webOrigin })).status, 400);

  // A previously valid session must lose profile access if verification is removed.
  f.database.prepare('UPDATE user SET emailVerified = 0 WHERE id = ?').run(idA);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 403);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin })).status, 403);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM patient_profile').get().count, 0);
  f.database.prepare('UPDATE user SET emailVerified = 1 WHERE id = ?').run(idA);

  const first = await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin });
  assert.equal(first.status, 201);
  const profileA = (await first.json()).profile;
  assert.match(profileA.id, /^[0-9a-f-]{36}$/i);
  assert.ok(profileA.createdAt);
  assert.deepEqual(Object.keys(profileA).sort(), ['createdAt', 'id']);
  const repeated = await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin });
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).profile, profileA);

  const accountBBefore = await f.request(path, { cookie: cookieB });
  assert.deepEqual(await accountBBefore.json(), { profile: null });
  const simultaneousCreates = await Promise.all([
    f.request(path, { cookie: cookieB, body: {}, origin: webOrigin }),
    f.request(path, { cookie: cookieB, body: {}, origin: webOrigin }),
  ]);
  assert.deepEqual(simultaneousCreates.map(response => response.status).sort(), [200, 201]);
  const profileB = (await simultaneousCreates[0].json()).profile;
  assert.deepEqual((await simultaneousCreates[1].json()).profile, profileB);
  assert.notEqual(profileB.id, profileA.id);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM patient_profile').get().count, 2);

  await f.request('/api/auth/sign-out', { cookie: cookieA, body: {}, origin: webOrigin });
  assert.equal((await f.request(path, { cookie: cookieA })).status, 401);
  assert.equal((await f.request(path, { cookie: cookieA, body: {}, origin: webOrigin })).status, 401);

  await f.restart();
  const freshA = cookies(await signIn(f, userA.password, userA));
  assert.deepEqual((await (await f.request(path, { cookie: freshA })).json()).profile, profileA);
  assert.equal((await f.request(path, { cookie: cookieA })).status, 401);
  assert.equal(idA, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = ?').get(profileA.id).account_user_id);
  assert.equal(idB, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = ?').get(profileB.id).account_user_id);
});

test('patient profile migration is idempotent and keeps existing Better Auth users', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const before = f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId);
  const cookie = cookies(await signIn(f));
  // Reproduce upgrading an auth-only database containing an existing user/session.
  f.database.exec('DROP TABLE patient_profile');
  assert.throws(() => createApp(f.auth, { database: f.database, webOrigin: 'http://127.0.0.1:5173' }), /no such table: patient_profile/);
  migratePatientProfiles(f.database);
  migratePatientProfiles(f.database);
  assert.deepEqual(f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId), before);
  assert.equal((await (await f.request('/api/me', { cookie })).json()).id, userId);
  assert.throws(() => f.database.prepare('INSERT INTO patient_profile VALUES (?, ?, ?)').run('orphan', 'absent-user', new Date().toISOString()), /FOREIGN KEY/);

  const columns = f.database.prepare('PRAGMA table_info(patient_profile)').all();
  assert.deepEqual(columns.map(column => column.name), ['id', 'account_user_id', 'created_at']);
  const owner = columns.find(column => column.name === 'account_user_id');
  assert.equal(owner.notnull, 1);
  assert.ok(f.database.prepare("PRAGMA index_list('patient_profile')").all()
    .some(index => index.unique && f.database.prepare(`PRAGMA index_info('${index.name}')`).all()
      .some(column => column.name === 'account_user_id')));
  const foreignKey = f.database.prepare('PRAGMA foreign_key_list(patient_profile)').get();
  assert.equal(foreignKey.table, 'user');
  assert.equal(foreignKey.from, 'account_user_id');
  assert.equal(foreignKey.on_delete, 'RESTRICT');
  assert.equal(f.database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name LIKE '%role%'").get().count, 0);
});

test('measurement migration is idempotent and preserves existing user, session, and profile', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const profileResponse = await f.request('/api/patient-profile', { cookie: cookies(await signIn(f)), body: {}, origin: 'http://127.0.0.1:5173' });
  assert.equal(profileResponse.status, 201);
  const profile = (await profileResponse.json()).profile;
  const session = sampleSession('20000000-0000-4000-8000-000000000001');
  const cookie = cookies(await signIn(f));
  const endpoint = '/api/measurement-sessions';
  await f.request(endpoint, { cookie, body: session, origin: 'http://127.0.0.1:5173' });
  const userBefore = f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId);
  const sessionsBefore = f.database.prepare('SELECT count(*) AS count FROM session').get().count;
  f.database.exec('DROP TABLE measurement_interval; DROP TABLE measurement_session');
  migratePatientProfiles(f.database);
  migratePatientProfiles(f.database);
  assert.deepEqual(f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId), userBefore);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM session').get().count, sessionsBefore);
  assert.equal(f.database.prepare('SELECT id FROM patient_profile WHERE id = ?').get(profile.id).id, profile.id);
  assert.throws(() => f.database.prepare("INSERT INTO measurement_session VALUES ('bad', 'absent-profile', 'ble', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 'hash', 'now')").run(), /FOREIGN KEY/);
});

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
  assert.deepEqual(await me.json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false });
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
  assert.deepEqual(await me.json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false });
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
  assert.deepEqual(await (await f.request('/api/me', { cookie })).json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false });
  assert.deepEqual(await (await f.request('/api/me', { cookie })).json(), { id, name: account.name, email: account.email, emailVerified: true, twoFactorEnabled: false });
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
  assert.deepEqual(Object.keys(me).sort(), ['email', 'emailVerified', 'id', 'name', 'twoFactorEnabled']);
});

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
  assert.equal((await f.request('/api/auth/sign-out', { cookie: loginCookie, body: {} })).status, 200);
  assert.equal((await f.request('/api/me', { cookie: loginCookie })).status, 401);
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
