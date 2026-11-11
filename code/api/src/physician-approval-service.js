import { createHash, createHmac, randomUUID } from 'node:crypto';

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const TOKEN_DOMAIN = 'orthosohle/physician-approval-token/v1';

function digest(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function deriveToken(secret, record) {
  const key = createHmac('sha256', secret).update(`${TOKEN_DOMAIN}/key`, 'utf8').digest();
  const payload = [TOKEN_DOMAIN, record.issueId, record.applicationId, record.reviewerUserId, record.expiresAt].join('\0');
  return createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
}

/** Tokens are reproducible for outbox recovery but are never persisted in clear text. */
export function createPhysicianApprovalService(database, {
  secret,
  authorizeReviewer,
  hasCurrentSessionMfa,
  now = () => Date.now(),
  lifetimeMs = TOKEN_LIFETIME_MS,
} = {}) {
  if (!database?.prepare || typeof secret !== 'string' || secret.length < 32) {
    throw new TypeError('database and a strong configured secret are required');
  }

  const selectApplication = database.prepare(`
    SELECT application.id, application.account_user_id AS accountUserId, application.status,
      application.requested_at AS requestedAt,
      applicant.email AS email, applicant.name AS name
    FROM physician_review_application AS application
    JOIN user AS applicant ON applicant.id = application.account_user_id
    WHERE application.id = ?
  `);
  const findActiveIssue = database.prepare(`
    SELECT id AS issueId, application_id AS applicationId,
      reviewer_user_id AS reviewerUserId, expires_at AS expiresAt,
      recipient_email AS recipientEmail, created_at AS createdAt,
      materialized_at AS materializedAt
    FROM physician_review_approval_token
    WHERE application_id = ? AND reviewer_user_id = ? AND consumed_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `);
  const expireIssues = database.prepare(`
    UPDATE physician_review_approval_token SET consumed_at = ?
    WHERE application_id = ? AND consumed_at IS NULL
  `);
  const insertIssue = database.prepare(`
    INSERT INTO physician_review_approval_token
      (id, application_id, reviewer_user_id, token_digest, created_at, expires_at, consumed_at, recipient_email, materialized_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL)
  `);
  const findByDigest = database.prepare(`
    SELECT id AS issueId, application_id AS applicationId,
      reviewer_user_id AS reviewerUserId, expires_at AS expiresAt, consumed_at AS consumedAt
    FROM physician_review_approval_token WHERE token_digest = ?
  `);
  const consumeIssue = database.prepare(`
    UPDATE physician_review_approval_token SET consumed_at = ?
    WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
  `);
  const setApproved = database.prepare(`
    UPDATE physician_review_application SET status = 'approved'
    WHERE id = ? AND status = 'pending'
  `);
  const auditApproval = database.prepare(`
    INSERT INTO physician_review_approval_audit
      (id, application_id, reviewer_user_id, target_user_id, operator, action, result, evidence_reference, occurred_at)
    VALUES (?, ?, ?, ?, ?, 'approve', 'approved', ?, ?)
  `);
  const markMaterialized = database.prepare(`
    UPDATE physician_review_approval_token SET materialized_at = COALESCE(materialized_at, ?)
    WHERE id = ?
  `);

  const issueTx = database.transaction((applicationId, reviewerUserId, recipientEmail, instantMs) => {
    const application = selectApplication.get(applicationId);
    if (!application || application.status !== 'pending' || application.accountUserId === reviewerUserId) return null;
    const instant = new Date(instantMs).toISOString();
    let issue = findActiveIssue.get(applicationId, reviewerUserId, instant);
    if (issue && digest(deriveToken(secret, issue)) !== database.prepare(`
      SELECT token_digest FROM physician_review_approval_token WHERE id = ?
    `).get(issue.issueId)?.token_digest) {
      issue = null;
    }
    if (!issue) {
      expireIssues.run(instant, applicationId);
      const issueId = randomUUID();
      const expiresAt = new Date(instantMs + lifetimeMs).toISOString();
      issue = {
        issueId,
        applicationId,
        reviewerUserId,
        expiresAt,
        recipientEmail,
        createdAt: instant,
        materializedAt: null,
      };
      const token = deriveToken(secret, issue);
      insertIssue.run(issueId, applicationId, reviewerUserId, digest(token), instant, expiresAt, recipientEmail);
    }
    return {
      ...issue,
      requestedAt: application.requestedAt,
      token: deriveToken(secret, issue),
    };
  });

  const verifyTx = database.transaction((token, reviewer, action) => {
    if (!guard(authorizeReviewer, reviewer) || !guard(hasCurrentSessionMfa, reviewer)) {
      return { ok: false, reason: 'reviewer_or_fresh_mfa_required' };
    }
    const instantMs = now();
    const instant = new Date(instantMs).toISOString();
    const record = findByDigest.get(digest(token));
    if (!record || record.reviewerUserId !== reviewer.userId) {
      return { ok: false, reason: 'approval_unavailable' };
    }
    if (record.consumedAt || Date.parse(record.expiresAt) <= instantMs) {
      return { ok: false, reason: 'approval_unavailable' };
    }
    const application = selectApplication.get(record.applicationId);
    if (!application || application.status !== 'pending' || application.accountUserId === reviewer.userId) {
      return { ok: false, reason: 'approval_unavailable' };
    }
    if (action === 'inspect') {
      return {
        ok: true,
        application: {
          id: application.id,
          requestedAt: application.requestedAt,
          status: application.status,
          email: application.email,
          name: application.name,
        },
      };
    }
    if (consumeIssue.run(instant, record.issueId, instant).changes !== 1) {
      return { ok: false, reason: 'approval_unavailable' };
    }
    if (setApproved.run(record.applicationId).changes !== 1) {
      throw new Error('Approval state changed during transaction.');
    }
    auditApproval.run(randomUUID(), record.applicationId, reviewer.userId,
      application.accountUserId, reviewer.userId, record.issueId, instant);
    return { ok: true, application: { id: record.applicationId, status: 'approved' } };
  });

  return {
    issueForApplication(applicationId, reviewerUserId, recipientEmail) {
      return issueTx(applicationId, reviewerUserId, recipientEmail, now());
    },
    inspect(token, reviewer) { return verify(token, reviewer, 'inspect'); },
    approve(token, reviewer) { return verify(token, reviewer, 'approve'); },
    markMaterialized(issueId) {
      markMaterialized.run(new Date(now()).toISOString(), issueId);
    },
  };

  function verify(token, reviewer, action) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)
      || !reviewer || typeof reviewer.userId !== 'string' || typeof reviewer.sessionId !== 'string') {
      return { ok: false, reason: 'approval_unavailable' };
    }
    return verifyTx(token, reviewer, action);
  }
}

function guard(check, reviewer) {
  try { return typeof check === 'function' && check(reviewer) === true; } catch { return false; }
}
