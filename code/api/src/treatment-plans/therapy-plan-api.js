import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { hasFreshTotpProof } from '../sign-in/recent-totp-check.js';
import { createTherapyPlanRepository } from './therapy-plan-database.js';

const MAX_LIMIT_KG = 1_000_000;
const MAX_DECIMAL_PLACES = 3;

function validLimit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_LIMIT_KG) return false;
  const [coefficient, exponentText] = String(value).toLowerCase().split('e');
  const fractionLength = coefficient.includes('.') ? coefficient.length - coefficient.indexOf('.') - 1 : 0;
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const decimalPlaces = Math.max(0, fractionLength - exponent);
  return Number.isInteger(exponent) && decimalPlaces <= MAX_DECIMAL_PLACES;
}

/** Mount under /api/care; endpoints deliberately make no device acknowledgement claim. */
export function createTherapyPlanRouter(auth, database, { webOrigin, guards = {} } = {}) {
  const router = express.Router();
  const plans = createTherapyPlanRepository(database);
  const approved = guards.isPhysicianApprovedInTransaction ?? (() => false);

  router.use((req, res, next) => {
    if (req.method === 'POST' && req.get('Origin') !== webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'json_required' });
    if (req.method === 'POST') return express.json({ limit: '1kb', strict: true })(req, res, next);
    return next();
  });

  async function authenticated(req, res) {
    let session;
    try { session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); }
    catch { res.status(401).json({ error: 'authentication_required' }); return null; }
    if (!session?.user?.id || !session?.session?.id || !session?.session?.token) {
      res.status(401).json({ error: 'authentication_required' }); return null;
    }
    if (!session.user.emailVerified) { res.status(403).json({ error: 'email_verification_required' }); return null; }
    return session;
  }

  function guardedPhysician(session, patientId, operation) {
    try {
      return database.transaction(() => {
        const currentSession = database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
          WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
          .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
        const context = { user: session.user, session, request: null };
        if (!currentSession || approved(context) !== true || !hasFreshTotpProof(database, session.session)) return { kind: 'forbidden' };
        const relation = database.prepare(`SELECT 1 FROM patient_relation
          WHERE patient_profile_id = ? AND physician_user_id = ? AND status = 'active'`).get(patientId, session.user.id);
        if (!relation) return { kind: 'not_found' };
        return operation();
      }).immediate();
    } catch { return { kind: 'forbidden' }; }
  }

  router.get('/physician/patients/:patientId/therapy-plans', async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    const result = guardedPhysician(session, req.params.patientId, () => {
      const currentVersion = database.prepare(`SELECT MAX(version) AS currentVersion FROM therapy_plan_version
        WHERE relationship_id = (SELECT id FROM patient_relation
          WHERE patient_profile_id = ? AND physician_user_id = ? AND status = 'active')`)
        .get(req.params.patientId, session.user.id).currentVersion ?? null;
      return { kind: 'ok', plans: plans.history(req.params.patientId), currentVersion };
    });
    if (result.kind === 'forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'patient_not_found' });
    return res.json({ plans: result.plans, currentVersion: result.currentVersion });
  });

  router.post('/physician/patients/:patientId/therapy-plans', async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).sort().join(',') !== 'expectedVersion,limitKg' ||
      !validLimit(req.body.limitKg) || !(req.body.expectedVersion === null ||
        (Number.isSafeInteger(req.body.expectedVersion) && req.body.expectedVersion > 0))) {
      return res.status(400).json({ error: 'invalid_therapy_limit' });
    }
    const result = guardedPhysician(session, req.params.patientId,
      () => plans.createVersion(req.params.patientId, session.user.id, req.body.limitKg, req.body.expectedVersion));
    if (result.kind === 'forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found' || result.kind === 'not_related') return res.status(404).json({ error: 'patient_not_found' });
    if (result.kind === 'stale_version') return res.status(409).json({ error: 'therapy_plan_changed', currentVersion: result.currentVersion });
    return res.status(201).json({ plan: result.plan });
  });

  router.get('/patient/therapy-plan', async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    const result = database.transaction(() => {
      const live = database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
        WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
        .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
      if (!live) return null;
      return plans.currentForPatient(session.user.id);
    }).immediate();
    if (!result) return res.status(401).json({ error: 'authentication_required' });
    return res.json(result);
  });

  router.post('/patient/therapy-plan/confirm', async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 ||
      typeof req.body.versionId !== 'string' || req.body.versionId.length > 64) {
      return res.status(400).json({ error: 'invalid_confirmation' });
    }
    const result = database.transaction(() => {
      const live = database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
        WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
        .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
      return live ? plans.confirm(session.user.id, req.body.versionId) : { kind: 'forbidden' };
    }).immediate();
    if (result.kind === 'forbidden') return res.status(401).json({ error: 'authentication_required' });
    if (result.kind !== 'confirmed') return res.status(409).json({ error: 'current_plan_changed' });
    return res.json({ confirmation: result.confirmation });
  });

  return router;
}
