import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { createPatientProfileRouter } from './patient-profile-routes.js';
import { createMeasurementSessionRouter } from './measurement-session-routes.js';
import { createPhysicianReviewRouter } from './physician-review-routes.js';
import { createPhysicianApprovalRouter } from './physician-approval-routes.js';
import { createTotpStepUpRouter, hasFreshTotpProof } from './totp-step-up.js';
import { createPatientRelationsRouter } from './patient-relations.js';
import { createPhysicianMeasurementSessionRouter } from './physician-measurement-session-routes.js';
import { createTherapyPlanRouter } from './therapy-plan.js';

export function createApp(auth, config = {}) {
  const { database, webOrigin } = config;
  if (!database || !webOrigin) throw new Error('API database and web origin are required.');
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.all('/api/auth/*splat', toNodeHandler(auth));
  app.get('/api/me', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    // Only the authenticated profile is returned, never tokens or health data.
    return res.json({ id: session.user.id, name: session.user.name, email: session.user.email,
      emailVerified: session.user.emailVerified, twoFactorEnabled: session.user.twoFactorEnabled === true });
  });
  app.use('/api/patient-profile', createPatientProfileRouter(auth, database, webOrigin));
  app.use('/api/measurement-sessions', createMeasurementSessionRouter(auth, database, webOrigin));
  const approval = createPhysicianApprovalRouter(auth, database, config);
  const approved = userId => Boolean(database.prepare(`SELECT 1 FROM physician_review_application
    WHERE account_user_id = ? AND status = 'approved'`).get(userId));
  const assurance = ({ session }) => hasFreshTotpProof(database, session.session);
  app.use('/api/step-up', createTotpStepUpRouter(auth, database, config));
  app.use('/api/physician-review/approval', approval.router);
  app.use('/api/physician-review', createPhysicianReviewRouter(auth, database, config, () => approval.recoverPendingNotifications()));
  app.use('/api/care', createTherapyPlanRouter(auth, database, {
    webOrigin, guards: { isPhysicianApprovedInTransaction: ({ user }) => approved(user.id) },
  }));
  app.use('/api/care/physician', createPhysicianMeasurementSessionRouter(auth, database, {
    guards: { isPhysicianApprovedInTransaction: ({ user }) => approved(user.id) },
  }));
  app.use('/api/care', createPatientRelationsRouter(auth, database, {
    webOrigin, invitationLifetimeMs: 24 * 60 * 60 * 1000,
    guards: {
      isPhysicianApprovedInTransaction: ({ user }) => approved(user.id),
      hasPhysicianAssuranceInTransaction: assurance,
      isPhysicianCurrentlyApprovedInTransaction: ({ physicianUserId }) => approved(physicianUserId),
    },
  }));
  try {
    approval.recoverPendingNotifications();
  } catch {
    // The original request remains pending; a later retry can rematerialize it.
    console.error('Local physician approval notifications could not be prepared.');
  }
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'body_too_large' });
    return res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
