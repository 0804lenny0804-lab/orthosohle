import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import test from 'node:test';
import { account, cookies, fixture, signIn, signUp } from './test-support.js';
import { migratePhysicianApproval } from '../src/physician-approval-migration.js';
import { createPhysicianApprovalRouter } from '../src/physician-approval-routes.js';
import { migrateReviewerBootstrap } from '../src/reviewer-bootstrap-migration.js';
import { createReviewerBootstrapRepository } from '../src/reviewer-bootstrap-repository.js';
import { createTotpStepUpRouter } from '../src/totp-step-up.js';
import { migrateTotpStepUp } from '../src/totp-step-up-migration.js';

const WEB_ORIGIN = 'http://127.0.0.1:5173';
const REVIEWER = { ...account, name: 'Approval Reviewer', email: 'reviewer@example.invalid' };
const PATIENT = { ...account, name: 'Approval Applicant', email: 'applicant@example.invalid' };

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const bytes = [];
  for (const character of value.toUpperCase()) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid test TOTP secret.');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) { bytes.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return String.fromCharCode(...bytes);
}

async function createFixture(t) {
  const f = await fixture(t);
  migratePhysicianApproval(f.database);
  migrateReviewerBootstrap(f.database);
  migrateTotpStepUp(f.database);
  const reviewerId = await signUp(f, true, REVIEWER);
  const initialCookie = cookies(await signIn(f, REVIEWER.password, REVIEWER));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: initialCookie, body: { password: REVIEWER.password, method: 'totp' },
  });
  assert.equal(setup.status, 200);
  const setupData = await setup.json();
  const secret = decodeBase32(new URL(setupData.totpURI).searchParams.get('secret'));
  const setupCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const enabled = await f.request('/api/auth/two-factor/verify-totp', { cookie: initialCookie, body: { code: setupCode } });
  assert.equal(enabled.status, 200);
  createReviewerBootstrapRepository(f.database, REVIEWER.email).grant('synthetic API test operator');
  const challenge = await signIn(f, REVIEWER.password, REVIEWER);
  const challengeData = await challenge.json();
  assert.equal(challenge.status, 200);
  assert.equal(challengeData.twoFactorRedirect, true);
  const challengeCookie = challenge.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  const loginCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const loginVerified = await f.request('/api/auth/two-factor/verify-totp', {
    cookie: challengeCookie, body: { code: loginCode },
  });
  assert.equal(loginVerified.status, 200);
  const reviewerCookie = cookies(loginVerified);

  const server = createServer();
  const app = express();
  const config = {
    secret: 'test-approval-key-with-adequate-length-0000000000',
    webOrigin: WEB_ORIGIN,
    databasePath: f.databasePath,
    physicianReviewNotifyEmail: REVIEWER.email,
  };
  const approval = createPhysicianApprovalRouter(f.auth, f.database, config);
  app.use('/approval', approval.router);
  app.use('/step-up', createTotpStepUpRouter(f.auth, f.database, { webOrigin: WEB_ORIGIN }));
  server.on('request', app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));

  async function call(path, { cookie = reviewerCookie, body, method = body === undefined ? 'GET' : 'POST', origin = WEB_ORIGIN } = {}) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  return { f, call, approval, reviewerCookie, secret, reviewerId, config };
}

async function requestApplication(f, email) {
  const patient = { ...PATIENT, email };
  await signUp(f, true, patient);
  const cookie = cookies(await signIn(f, patient.password, patient));
  const submitted = await f.request('/api/physician-review', {
    cookie, body: {}, origin: 'http://127.0.0.1:5173',
  });
  assert.ok([200, 201].includes(submitted.status), await submitted.clone().text());
  return { cookie, review: (await submitted.json()).review };
}

async function tokenFromApprovalMail(f) {
  const issue = f.database.prepare(`
    SELECT id FROM physician_review_approval_token
    WHERE consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1
  `).get(new Date().toISOString());
  const entry = (await f.mails()).find(({ path, mail }) =>
    mail.subject === 'Lokaler Test: Arztantrag wartet auf Freigabe' && path.endsWith(`${issue.id}.json`));
  assert.ok(entry, 'private local approval notification should be materialized');
  assert.equal(entry.mail.to, REVIEWER.email);
  assert.match(entry.mail.mode, /NOT SENT/);
  assert.equal(typeof entry.mail.approvalURL, 'string');
  assert.equal(entry.mail.approvalURL, linkFromText(entry.mail.text));
  assert.equal((await stat(entry.path)).mode & 0o077, 0);
  const link = entry.mail.text.match(/https?:\/\/[^\s]+/)[0];
  const parsed = new URL(link);
  assert.equal(parsed.searchParams.get('physicianApproval'), '1');
  const token = new URLSearchParams(parsed.hash.slice(1)).get('token');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  return token;
}

function linkFromText(text) {
  return text.match(/https?:\/\/[^\s]+/)[0];
}

async function establishFreshMfa(f, call, cookie, secret) {
  const code = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const response = await call('/step-up/verify', { cookie, body: { code } });
  assert.equal(response.status, 200, await response.clone().text());
}

test('real HTTP approval requires reviewer session and step-up, keeps GET read-only, and handles replay/concurrency', async t => {
  const { f, call, approval, reviewerCookie, secret } = await createFixture(t);
  const created = await requestApplication(f, 'applicant-one@example.invalid');
  assert.equal(created.review.status, 'pending');
  const markMaterialized = approval.service.markMaterialized;
  approval.service.markMaterialized = () => { throw new Error('simulated crash after atomic file publish'); };
  assert.throws(() => approval.recoverPendingNotifications(), /simulated crash/);
  assert.equal(f.database.prepare('SELECT materialized_at FROM physician_review_approval_token').get().materialized_at, null);
  approval.service.markMaterialized = markMaterialized;
  assert.equal(approval.recoverPendingNotifications(), 1);
  assert.equal(approval.recoverPendingNotifications(), 0);
  assert.equal((await f.mails()).filter(({ mail }) => mail.subject === 'Lokaler Test: Arztantrag wartet auf Freigabe').length, 1);
  const token = await tokenFromApprovalMail(f);

  assert.equal((await call('/approval/')).status, 403);
  assert.equal((await call('/approval/inspect', { body: { token } })).status, 403);
  assert.equal((await call('/approval/inspect', { cookie: created.cookie, body: { token } })).status, 403);
  assert.equal((await call('/approval/inspect', { body: { token }, origin: 'https://foreign.invalid' })).status, 403);

  await establishFreshMfa(f, call, reviewerCookie, secret);
  const before = f.database.prepare('SELECT consumed_at FROM physician_review_approval_token').get().consumed_at;
  assert.equal(before, null);
  const page = await call('/approval/');
  assert.equal(page.status, 200);
  assert.deepEqual(await page.json(), { reviewer: { authorized: true, mfaVerified: true } });
  assert.equal(f.database.prepare('SELECT status FROM physician_review_application').get().status, 'pending');
  const inspected = await call('/approval/inspect', { body: { token } });
  assert.equal(inspected.status, 200);
  assert.deepEqual(await inspected.json(), { application: {
    id: f.database.prepare('SELECT id FROM physician_review_application').get().id,
    requestedAt: created.review.requestedAt,
    status: 'pending',
    email: 'applicant-one@example.invalid',
    name: 'Approval Applicant',
  } });
  assert.equal(f.database.prepare('SELECT consumed_at FROM physician_review_approval_token').get().consumed_at, null);

  const approvals = await Promise.all([
    call('/approval/approve', { body: { token } }),
    call('/approval/approve', { body: { token } }),
  ]);
  assert.deepEqual(approvals.map(response => response.status).sort(), [200, 410]);
  assert.equal(f.database.prepare('SELECT status FROM physician_review_application').get().status, 'approved');
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
  assert.equal((await call('/approval/approve', { body: { token } })).status, 410);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
});

test('existing materialized requests recover links, expired links reissue, and logout invalidates the session', async t => {
  const { f, call, approval, reviewerCookie, secret, config } = await createFixture(t);
  const created = await requestApplication(f, 'applicant-two@example.invalid');
  assert.equal(approval.recoverPendingNotifications(), 1);
  const token = await tokenFromApprovalMail(f);
  const issueId = f.database.prepare('SELECT id FROM physician_review_approval_token').get().id;
  f.database.prepare('UPDATE physician_review_approval_token SET expires_at = ? WHERE id = ?')
    .run(new Date(Date.now() - 1).toISOString(), issueId);
  assert.equal(approval.recoverPendingNotifications(), 1);
  const reissuedToken = await tokenFromApprovalMail(f);
  assert.notEqual(reissuedToken, token);
  config.physicianReviewNotifyEmail = 'changed-reviewer@example.invalid';
  assert.equal(approval.recoverPendingNotifications(), 0);
  await establishFreshMfa(f, call, reviewerCookie, secret);
  assert.equal((await call('/approval/inspect', { body: { token: reissuedToken } })).status, 403);
  config.physicianReviewNotifyEmail = REVIEWER.email;
  assert.equal((await call('/approval/inspect', { body: { token } })).status, 410);

  const signedOut = await f.request('/api/auth/sign-out', { cookie: reviewerCookie, body: {} });
  assert.equal(signedOut.status, 200);
  assert.equal((await call('/approval/inspect', { body: { token: reissuedToken } })).status, 401);
  assert.equal(f.database.prepare('SELECT status FROM physician_review_application').get().status, 'pending');
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 0);
  assert.equal(created.review.status, 'pending');
});

test('legacy approval JSON survives retry after a crash without being rewritten', async t => {
  const { f, approval, reviewerId } = await createFixture(t);
  const { review } = await requestApplication(f, 'legacy-applicant@example.invalid');
  const applicationId = f.database.prepare('SELECT id FROM physician_review_application').get().id;
  const issue = approval.service.issueForApplication(applicationId, reviewerId, REVIEWER.email);
  const oldLink = new URL('/', WEB_ORIGIN);
  oldLink.searchParams.set('physicianApproval', '1');
  oldLink.hash = `token=${issue.token}`;
  const legacy = {
    mode: 'LOCAL SYNTHETIC TEST MAIL — NOT SENT',
    to: REVIEWER.email,
    subject: 'Lokaler Test: Arztantrag wartet auf Freigabe',
    text: [
      'Dies ist eine lokale Kontrollbenachrichtigung. Es wurde keine E-Mail versendet.',
      `Antragsreferenz: ${applicationId}`,
      `Freigabelink (bis ${issue.expiresAt} gültig, einmalig): ${oldLink.href}`,
      'Der Link zeigt beim Öffnen noch keine Freigabe an. Die Freigabe erfordert eine bestätigte Aktion im angemeldeten Prüferkonto.',
    ].join('\n'),
  };
  const path = `${f.databasePath}.mail-outbox/physician-approval-${issue.issueId}.json`;
  await writeFile(path, JSON.stringify(legacy, null, 2));

  assert.equal(approval.recoverPendingNotifications(), 1);
  assert.equal(await readFile(path, 'utf8'), JSON.stringify(legacy, null, 2));
  assert.equal((await f.mails()).find(entry => entry.path === path).mail.approvalURL, undefined);
  assert.equal(review.status, 'pending');
});
