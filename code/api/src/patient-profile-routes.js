import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { createPatientProfileRepository } from './patient-profile-repository.js';

export function createPatientProfileRouter(auth, database, webOrigin) {
  const router = express.Router();
  const profiles = createPatientProfileRepository(database);

  router.get('/', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    return res.json({ profile: profiles.findForAccount(session.user.id) });
  });

  router.post('/', (req, res, next) => {
    if (req.get('Origin') !== webOrigin) {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'json_required' });
    }
    return next();
  }, express.json({ limit: '1kb', strict: true }), async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
      return res.status(400).json({ error: 'empty_object_required' });
    }

    const existing = profiles.findForAccount(session.user.id);
    if (existing) return res.json({ profile: existing });
    const profile = profiles.createForAccount(session.user.id);
    return res.status(201).json({ profile });
  });

  return router;
}
