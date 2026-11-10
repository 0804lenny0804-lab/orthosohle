import assert from 'node:assert/strict';
import { rm, stat, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { migratePhysicianReview } from '../src/physician-review-migration.js';
import { account, cookies, fixture, signIn, signUp } from './test-support.js';

const endpoint = '/api/physician-review';
const webOrigin = 'http://127.0.0.1:5173';

test('requests are verified, session-owned, pending-only, idempotent and local', async t => {
  const f = await fixture(t);
  const userA = { ...account, name: 'Physician Applicant A', email: 'physician-a@example.invalid' };
  const userB = { ...account, name: 'Physician Applicant B', email: 'physician-b@example.invalid' };
  const idA = await signUp(f, true, userA);
  const idB = await signUp(f, true, userB);
  const cookieA = cookies(await signIn(f, userA.password, userA));
  const cookieB = cookies(await signIn(f, userB.password, userB));

  assert.equal((await f.request(endpoint)).status, 401);
  assert.equal((await f.request(endpoint, { body: {}, origin: webOrigin })).status, 401);
  assert.deepEqual(await (await f.request(endpoint, { cookie: cookieA })).json(), { review: null });
  assert.equal((await f.request(endpoint, { cookie: cookieA, body: {}, origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.request(endpoint, { cookie: cookieA, body: {}, omitOrigin: true })).status, 403);
  assert.equal((await f.request(endpoint, { cookie: cookieA, body: {}, contentType: 'text/plain', origin: webOrigin })).status, 415);
  assert.equal((await f.request(endpoint, { cookie: cookieA, rawBody: '{', origin: webOrigin })).status, 400);
  for (const forged of [
    { accountUserId: idB }, { userId: idB }, { role: 'doctor' }, { status: 'approved' }, { email: userB.email },
  ]) {
    assert.equal((await f.request(endpoint, { cookie: cookieA, body: forged, origin: webOrigin })).status, 400);
  }
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 0);

  f.database.prepare('UPDATE user SET emailVerified = 0 WHERE id = ?').run(idA);
  assert.equal((await f.request(endpoint, { cookie: cookieA })).status, 403);
  assert.equal((await f.request(endpoint, { cookie: cookieA, body: {}, origin: webOrigin })).status, 403);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 0);
  f.database.prepare('UPDATE user SET emailVerified = 1 WHERE id = ?').run(idA);

  const attempts = await Promise.all(Array.from({ length: 8 }, () => f.request(endpoint, {
    cookie: cookieA, body: {}, origin: webOrigin,
  })));
  assert.deepEqual(attempts.map(response => response.status).sort((left, right) => left - right), [
    200, 200, 200, 200, 200, 200, 200, 201,
  ]);
  const statusA = await f.request(endpoint, { cookie: cookieA });
  const reviewA = (await statusA.json()).review;
  assert.equal(statusA.status, 200);
  assert.deepEqual(Object.keys(reviewA).sort(), ['notificationStatus', 'requestedAt', 'status']);
  assert.equal(reviewA.status, 'pending');
  assert.equal(reviewA.notificationStatus, 'materialized');
  assert.match(reviewA.requestedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(await (await f.request(endpoint, { cookie: cookieB })).json(), { review: null });
  assert.equal(idB, f.database.prepare('SELECT id FROM user WHERE id = ?').get(idB).id);

  const rows = f.database.prepare(`
    SELECT application.account_user_id AS accountId, application.status,
      notification.recipient_email AS recipient, notification.applicant_email AS applicant,
      notification.materialized_at AS materializedAt
    FROM physician_review_application AS application
    JOIN physician_review_outbox AS notification ON notification.application_id = application.id
  `).all();
  assert.deepEqual(rows.map(({ accountId, status, recipient, applicant }) => ({ accountId, status, recipient, applicant })), [{
    accountId: idA,
    status: 'pending',
    recipient: 'lo030@hdm-stuttgart.de',
    applicant: userA.email,
  }]);
  assert.match(rows[0].materializedAt, /^\d{4}-/);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 1);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_outbox').get().count, 1);

  const notifications = (await f.mails()).filter(entry => entry.mail.subject === 'Lokaler Test: Antrag auf Arztprüfung eingegangen');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].mail.to, 'lo030@hdm-stuttgart.de');
  assert.match(notifications[0].mail.mode, /NOT SENT/);
  const applicationId = f.database.prepare('SELECT id FROM physician_review_application WHERE account_user_id = ?').get(idA).id;
  assert.match(notifications[0].mail.text, new RegExp(applicationId));
  assert.match(notifications[0].mail.text, new RegExp(userA.email));
  assert.doesNotMatch(notifications[0].mail.text, /https?:\/\/|token=|freigabe-link/i);
  assert.equal((await stat(notifications[0].path)).mode & 0o077, 0);

  const submittedB = await f.request(endpoint, { cookie: cookieB, body: {}, origin: webOrigin });
  assert.equal(submittedB.status, 201);
  const reviewB = (await submittedB.json()).review;
  assert.equal(reviewB.status, 'pending');
  assert.equal(reviewB.notificationStatus, 'materialized');
  assert.equal((await f.request(endpoint, { cookie: cookieB })).status, 200);
  await f.restart();
  assert.deepEqual((await (await f.request(endpoint, { cookie: cookieA })).json()).review, reviewA);
  assert.deepEqual((await (await f.request(endpoint, { cookie: cookieB })).json()).review, reviewB);
  assert.equal((await f.request(endpoint, { cookie: cookieA, body: {}, origin: webOrigin })).status, 200);
  assert.equal((await f.mails()).filter(entry => entry.mail.subject === 'Lokaler Test: Antrag auf Arztprüfung eingegangen').length, 2);
});

test('outbox failure is visible and retry materializes the same event', async t => {
  const f = await fixture(t);
  const user = { ...account, email: 'physician-retry@example.invalid' };
  await signUp(f, true, user);
  const cookie = cookies(await signIn(f, user.password, user));
  const blockedPath = `${f.databasePath}.mail-outbox`;
  await rm(blockedPath, { recursive: true, force: true });
  await writeFile(blockedPath, 'deliberately blocks directory creation');

  const failed = await f.request(endpoint, { cookie, body: {}, origin: webOrigin });
  assert.equal(failed.status, 503);
  const failureBody = await failed.json();
  assert.equal(failureBody.error, 'notification_not_materialized');
  assert.equal(failureBody.review.status, 'pending');
  assert.equal(failureBody.review.notificationStatus, 'pending');
  assert.match(failureBody.review.requestedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 1);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_outbox WHERE materialized_at IS NULL').get().count, 1);
  assert.equal((await (await f.request(endpoint, { cookie })).json()).review.notificationStatus, 'pending');

  await rm(blockedPath);
  const retried = await f.request(endpoint, { cookie, body: {}, origin: webOrigin });
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).review.notificationStatus, 'materialized');
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 1);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_outbox').get().count, 1);
  assert.ok(f.database.prepare('SELECT materialized_at FROM physician_review_outbox').get().materialized_at);
  assert.equal((await f.mails()).filter(entry => entry.mail.subject === 'Lokaler Test: Antrag auf Arztprüfung eingegangen').length, 1);
});

test('missing recipient fails closed without making a request', async t => {
  const f = await fixture(t, { physicianReviewNotifyEmail: null });
  const user = { ...account, email: 'physician-unconfigured@example.invalid' };
  await signUp(f, true, user);
  const cookie = cookies(await signIn(f, user.password, user));

  assert.deepEqual(await (await f.request(endpoint, { cookie })).json(), { review: null });
  const response = await f.request(endpoint, { cookie, body: {}, origin: webOrigin });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'notification_recipient_not_configured' });
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 0);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_outbox').get().count, 0);
});

test('migration is idempotent and retains existing authentication state', async t => {
  const f = await fixture(t);
  const userId = await signUp(f);
  const session = cookies(await signIn(f));
  const userBefore = f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId);
  f.database.exec('DROP TABLE physician_review_outbox; DROP TABLE physician_review_application');
  migratePhysicianReview(f.database);
  migratePhysicianReview(f.database);
  assert.deepEqual(f.database.prepare('SELECT id, email FROM user WHERE id = ?').get(userId), userBefore);
  assert.equal((await f.request('/api/me', { cookie: session })).status, 200);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_application').get().count, 0);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_review_outbox').get().count, 0);
  assert.throws(() => f.database.prepare(`
    INSERT INTO physician_review_application (id, account_user_id, status, requested_at)
    VALUES ('orphan', 'absent-user', 'pending', '2026-01-01T00:00:00.000Z')
  `).run(), /FOREIGN KEY/);
});
