import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { createPatientProfileRouter } from './patient-profile-routes.js';
import { createMeasurementSessionRouter } from './measurement-session-routes.js';
import { createPhysicianReviewRouter } from './physician-review-routes.js';

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
    return res.json({ id: session.user.id, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified });
  });
  app.use('/api/patient-profile', createPatientProfileRouter(auth, database, webOrigin));
  app.use('/api/measurement-sessions', createMeasurementSessionRouter(auth, database, webOrigin));
  app.use('/api/physician-review', createPhysicianReviewRouter(auth, database, config));
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'body_too_large' });
    return res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
