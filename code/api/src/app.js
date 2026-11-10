import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';

export function createApp(auth) {
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
  app.use((_error, _req, res, _next) => {
    res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
