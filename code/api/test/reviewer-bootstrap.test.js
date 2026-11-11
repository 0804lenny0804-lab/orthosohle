import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateReviewerBootstrap } from '../src/reviewer-bootstrap-migration.js';
import { createReviewerBootstrapRepository } from '../src/reviewer-bootstrap-repository.js';
import { account, fixture, signUp } from './test-support.js';

const configuredEmail = 'configured-reviewer@example.invalid';

async function setup(t, { verified = true, totp = true, totpVerified = true } = {}) {
  const f = await fixture(t);
  const reviewer = { ...account, email: configuredEmail };
  const reviewerId = await signUp(f, verified, reviewer);
  f.database.prepare('UPDATE user SET twoFactorEnabled = ? WHERE id = ?').run(totp ? 1 : 0, reviewerId);
  if (totp) {
    f.database.prepare(`INSERT INTO twoFactor (id, secret, backupCodes, userId, verified)
      VALUES ('synthetic-totp', 'synthetic-secret', 'synthetic-backup-codes', ?, ?)`)
      .run(reviewerId, totpVerified ? 1 : 0);
  }
  const now = new Date();
  const token = 'reviewer-session-for-revocation-check';
  f.database.prepare(`INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt)
    VALUES ('test-session', ?, ?, ?, ?, ?)`).run(token, reviewerId,
    new Date(now.getTime() + 60_000).toISOString(), now.toISOString(), now.toISOString());
  migrateReviewerBootstrap(f.database);
  return { f, reviewerId, token, repository: createReviewerBootstrapRepository(f.database, configuredEmail) };
}

test('bootstrap is restricted to the configured, verified, TOTP-enrolled identity', async t => {
  const missing = await setup(t, { verified: false });
  assert.throws(() => missing.repository.grant('Local operator'), /verified_totp_account_required/);

  const noTotp = await setup(t, { totp: false });
  assert.throws(() => noTotp.repository.grant('Local operator'), /verified_totp_account_required/);

  const pendingTotp = await setup(t, { totpVerified: false });
  assert.throws(() => pendingTotp.repository.grant('Local operator'), /verified_totp_account_required/);

  const f = await fixture(t);
  const other = { ...account, email: 'unconfigured@example.invalid' };
  const otherId = await signUp(f, true, other);
  f.database.prepare('UPDATE user SET twoFactorEnabled = 1 WHERE id = ?').run(otherId);
  migrateReviewerBootstrap(f.database);
  const onlyConfigured = createReviewerBootstrapRepository(f.database, configuredEmail);
  assert.throws(() => onlyConfigured.grant('Local operator'), /verified_totp_account_required/);
  assert.throws(() => onlyConfigured.grant(''), /explicit_local_operator_required/);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_reviewer_grant').get().count, 0);
});

test('grant/revoke are atomic, audited, idempotent, and revoke sessions', async t => {
  const { f, reviewerId, token, repository } = await setup(t);
  migrateReviewerBootstrap(f.database);
  assert.deepEqual(repository.grant('Local operator'), { changed: true, status: 'active' });
  assert.deepEqual(repository.grant('Local operator'), { changed: false, status: 'active' });
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_reviewer_audit').get().count, 1);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM session WHERE token = ?').get(token).count, 0);

  const now = new Date();
  f.database.prepare(`INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt)
    VALUES ('recreated-session', 'fresh-reviewer-session', ?, ?, ?, ?)`).run(reviewerId,
    new Date(now.getTime() + 60_000).toISOString(), now.toISOString(), now.toISOString());
  f.database.exec(`CREATE TRIGGER fail_reviewer_session_delete BEFORE DELETE ON session
    WHEN OLD.userId = '${reviewerId}' BEGIN SELECT RAISE(ABORT, 'blocked'); END`);
  assert.throws(() => repository.revoke('Local operator'));
  assert.equal(f.database.prepare('SELECT status FROM physician_reviewer_grant WHERE user_id = ?').get(reviewerId).status, 'active');
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_reviewer_audit').get().count, 1);
  f.database.exec('DROP TRIGGER fail_reviewer_session_delete');

  assert.deepEqual(repository.revoke('Local operator'), { changed: true, status: 'revoked' });
  assert.deepEqual(repository.revoke('Local operator'), { changed: false, status: 'revoked' });
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM session WHERE userId = ?').get(reviewerId).count, 0);
  assert.deepEqual(f.database.prepare(`SELECT operator, reviewer_user_id AS reviewer, action
    FROM physician_reviewer_audit ORDER BY rowid`).all(), [
    { operator: 'Local operator', reviewer: reviewerId, action: 'grant' },
    { operator: 'Local operator', reviewer: reviewerId, action: 'revoke' },
  ]);
  assert.throws(() => f.database.prepare('DELETE FROM physician_reviewer_audit').run(), /immutable/);
  assert.throws(() => f.database.prepare("UPDATE physician_reviewer_audit SET action = 'grant'").run(), /immutable/);
});

test('revocation remains possible after email verification and TOTP have been disabled', async t => {
  const { f, reviewerId, repository } = await setup(t);
  assert.equal(repository.grant('Local operator').status, 'active');
  f.database.prepare('UPDATE user SET emailVerified = 0, twoFactorEnabled = 0 WHERE id = ?').run(reviewerId);
  f.database.prepare('UPDATE twoFactor SET verified = 0 WHERE userId = ?').run(reviewerId);
  assert.deepEqual(repository.revoke('Local operator'), { changed: true, status: 'revoked' });
  assert.deepEqual(repository.revoke('Local operator'), { changed: false, status: 'revoked' });
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM physician_reviewer_audit WHERE action = \'revoke\'').get().count, 1);
});
