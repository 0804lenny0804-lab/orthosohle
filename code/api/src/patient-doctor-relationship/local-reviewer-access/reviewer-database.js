import { randomUUID } from 'node:crypto';

export class ReviewerBootstrapError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReviewerBootstrapError';
    this.code = code;
  }
}

export function createReviewerBootstrapRepository(database, configuredReviewerEmail) {
  if (typeof configuredReviewerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredReviewerEmail)) {
    throw new Error('A concrete reviewer email identity must be configured.');
  }

  const operation = database.transaction((operator, action) => {
    if (typeof operator !== 'string' || operator.trim().length < 2 || operator.length > 100
      || /[\r\n\0]/.test(operator)) {
      throw new ReviewerBootstrapError('explicit_local_operator_required');
    }
    const subject = database.prepare(`
      SELECT user.id, user.emailVerified, user.twoFactorEnabled,
        EXISTS (SELECT 1 FROM twoFactor WHERE userId = user.id AND verified = 1) AS verifiedTotp
      FROM user WHERE lower(user.email) = lower(?)
    `).get(configuredReviewerEmail);

    if (!subject) {
      if (action === 'revoke') return { changed: false, status: 'absent' };
      throw new ReviewerBootstrapError('verified_totp_account_required');
    }
    const prior = database.prepare('SELECT status FROM physician_reviewer_grant WHERE user_id = ?').get(subject.id);
    if (action === 'grant') {
      if (subject.emailVerified !== 1 || subject.twoFactorEnabled !== 1 || subject.verifiedTotp !== 1) {
        throw new ReviewerBootstrapError('verified_totp_account_required');
      }
      if (prior?.status === 'active') return { changed: false, status: 'active' };
      const now = new Date().toISOString();
      database.prepare(`
        INSERT INTO physician_reviewer_grant (user_id, status, granted_at, revoked_at)
        VALUES (?, 'active', ?, NULL)
        ON CONFLICT(user_id) DO UPDATE SET status = 'active', granted_at = excluded.granted_at, revoked_at = NULL
      `).run(subject.id, now);
    } else {
      if (!prior || prior.status !== 'active') return { changed: false, status: prior?.status ?? 'absent' };
      database.prepare(`
        UPDATE physician_reviewer_grant SET status = 'revoked', revoked_at = ? WHERE user_id = ?
      `).run(new Date().toISOString(), subject.id);
    }
    // A role transition invalidates cached authorization in every session.
    database.prepare('DELETE FROM session WHERE userId = ?').run(subject.id);

    database.prepare(`
      INSERT INTO physician_reviewer_audit (id, operator, reviewer_user_id, action, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), operator.trim(), subject.id, action, new Date().toISOString());
    return { changed: true, status: action === 'grant' ? 'active' : 'revoked' };
  });

  return {
    grant(operator) { return operation(operator, 'grant'); },
    revoke(operator) { return operation(operator, 'revoke'); },
  };
}
