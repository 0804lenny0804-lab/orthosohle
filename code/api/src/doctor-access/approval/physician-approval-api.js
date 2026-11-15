import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { materializePhysicianApprovalNotification } from './physician-approval-notifier.js';
import { createPhysicianApprovalService } from './physician-approval-service.js';

function activeSession(database, reviewer, configuredReviewerEmail) {
  const now = new Date().toISOString();
  return Boolean(database.prepare(`
    SELECT 1 FROM session s
    JOIN physician_reviewer_grant g ON g.user_id = s.userId AND g.status = 'active'
    JOIN user u ON u.id = s.userId AND u.emailVerified = 1 AND u.twoFactorEnabled = 1
    JOIN twoFactor tf ON tf.userId = u.id AND tf.verified = 1
    WHERE s.id = ? AND s.userId = ? AND s.expiresAt > ? AND lower(u.email) = lower(?)
  `).get(reviewer.sessionId, reviewer.userId, now, configuredReviewerEmail));
}

function currentStepUp(database, reviewer, configuredReviewerEmail) {
  const now = Date.now();
  return Boolean(database.prepare(`
    SELECT 1 FROM session s
    JOIN totp_step_up_attempt p ON p.session_id = s.id AND p.user_id = s.userId
    JOIN physician_reviewer_grant g ON g.user_id = s.userId AND g.status = 'active'
    JOIN user u ON u.id = s.userId AND u.twoFactorEnabled = 1
    JOIN twoFactor tf ON tf.userId = u.id AND tf.verified = 1
    WHERE s.id = ? AND s.userId = ? AND s.expiresAt > ? AND lower(u.email) = lower(?)
      AND p.verified_at IS NOT NULL AND p.expires_at > ?
  `).get(reviewer.sessionId, reviewer.userId, new Date(now).toISOString(), configuredReviewerEmail, now));
}

async function resolveSession(auth, req) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session || typeof session.user?.id !== 'string' || typeof session.session?.id !== 'string') return null;
    return { userId: session.user.id, sessionId: session.session.id };
  } catch {
    return null;
  }
}

export function createPhysicianApprovalRouter(auth, database, config) {
  if (!database || !config?.webOrigin || !config?.secret) {
    throw new TypeError('Physician approval database, web origin, and secret are required.');
  }
  const service = createPhysicianApprovalService(database, {
    secret: config.secret,
    authorizeReviewer: reviewer => activeSession(database, reviewer, config.physicianReviewNotifyEmail),
    hasCurrentSessionMfa: reviewer => currentStepUp(database, reviewer, config.physicianReviewNotifyEmail),
  });
  const router = express.Router();

  router.use((req, res, next) => {
    if (req.method === 'GET') return next();
    if (req.get('Origin') !== config.webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'json_required' });
    return express.json({ limit: '2kb', strict: true })(req, res, next);
  });

  router.get('/', async (req, res) => {
    const reviewer = await resolveSession(auth, req);
    if (!reviewer) return res.status(401).json({ error: 'authentication_required' });
    const valid = database.transaction(() =>
      activeSession(database, reviewer, config.physicianReviewNotifyEmail)
        && currentStepUp(database, reviewer, config.physicianReviewNotifyEmail))();
    if (!valid) return res.status(403).json({ error: 'reviewer_or_fresh_mfa_required' });
    return res.json({ reviewer: { authorized: true, mfaVerified: true } });
  });

  router.post('/inspect', async (req, res) => {
    if (!validTokenBody(req.body)) return res.status(400).json({ error: 'invalid_request' });
    const reviewer = await resolveSession(auth, req);
    if (!reviewer) return res.status(401).json({ error: 'authentication_required' });
    const result = service.inspect(req.body.token, reviewer);
    if (!result.ok) return sendServiceError(res, result.reason);
    return res.json({ application: result.application });
  });

  router.post('/approve', async (req, res) => {
    if (!validTokenBody(req.body)) return res.status(400).json({ error: 'invalid_request' });
    const reviewer = await resolveSession(auth, req);
    if (!reviewer) return res.status(401).json({ error: 'authentication_required' });
    const result = service.approve(req.body.token, reviewer);
    if (!result.ok) return sendServiceError(res, result.reason);
    return res.json({ application: result.application });
  });

  return {
    router,
    service,
    recoverPendingNotifications() {
      if (typeof config.physicianReviewNotifyEmail !== 'string') return 0;
      const reviewers = database.prepare(`
        SELECT u.id AS userId, u.email AS email FROM physician_reviewer_grant g
        JOIN user u ON u.id = g.user_id
        JOIN twoFactor tf ON tf.userId = u.id AND tf.verified = 1
        WHERE g.status = 'active' AND u.emailVerified = 1 AND u.twoFactorEnabled = 1
          AND lower(u.email) = lower(?)
        ORDER BY u.id
      `).all(config.physicianReviewNotifyEmail);
      const applications = database.prepare(`
        SELECT id FROM physician_review_application WHERE status = 'pending' ORDER BY id
      `).all();
      const messages = [];
      for (const reviewer of reviewers) {
        for (const application of applications) {
          const issue = service.issueForApplication(application.id, reviewer.userId, reviewer.email);
          if (issue && !issue.materializedAt) {
            materializePhysicianApprovalNotification(config, service, issue);
            messages.push(issue.issueId);
          }
        }
      }
      return messages.length;
    },
  };
}

function validTokenBody(body) {
  return body && !Array.isArray(body) && Object.keys(body).length === 1
    && typeof body.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.token);
}

function sendServiceError(res, reason) {
  if (reason === 'reviewer_or_fresh_mfa_required') {
    return res.status(403).json({ error: 'reviewer_or_fresh_mfa_required' });
  }
  return res.status(410).json({ error: 'approval_unavailable' });
}
