import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { createPhysicianReviewRepository } from './physician-review-repository.js';
import { materializePhysicianReviewNotification } from './physician-review-notifier.js';

function publicReview(review) {
  if (!review) return null;
  return {
    status: review.status,
    requestedAt: review.requestedAt,
    notificationStatus: review.materializedAt ? 'materialized' : 'pending',
  };
}

export function createPhysicianReviewRouter(auth, database, config, onRequested = () => {}) {
  const router = express.Router();
  const reviews = createPhysicianReviewRepository(database);

  router.post('/', (req, res, next) => {
    if (req.get('Origin') !== config.webOrigin) {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'json_required' });
    }
    return express.json({ limit: '1kb', strict: true })(req, res, next);
  });

  router.get('/', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    const review = reviews.findForAccount(session.user.id);
    return res.json({ review: publicReview(review) });
  });

  router.post('/', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
      return res.status(400).json({ error: 'empty_object_required' });
    }
    if (!reviews.findForAccount(session.user.id) && !config.physicianReviewNotifyEmail) {
      return res.status(503).json({ error: 'notification_recipient_not_configured' });
    }

    let result;
    try {
      result = reviews.requestForAccount(
        session.user.id,
        session.user.email,
        config.physicianReviewNotifyEmail,
      );
    } catch {
      return res.status(500).json({ error: 'request_not_persisted' });
    }
    try {
      materializePhysicianReviewNotification(config, reviews, result.notification);
      onRequested();
    } catch {
      // The DB transaction stores both the pending request and one retryable outbox intent.
      // A later identical POST retries only materializing the same deterministic local file.
      return res.status(503).json({
        error: 'notification_not_materialized',
        review: publicReview(reviews.findForAccount(session.user.id)),
      });
    }
    return res.status(result.created ? 201 : 200).json({ review: publicReview(reviews.findForAccount(session.user.id)) });
  });

  return router;
}
