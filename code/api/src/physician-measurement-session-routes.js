import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { createMeasurementSessionRepository } from './measurement-session-repository.js';
import { hasFreshTotpProof } from './totp-step-up.js';

const ID = /^[0-9a-f-]{36}$/i;
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;

function validTime(value) {
  if (typeof value !== 'string' || !UTC.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const canonical = new Date(Date.parse(value)).toISOString();
  return value === canonical || value === canonical.replace('.000Z', 'Z');
}

function pagination(query) {
  const limitText = query.limit ?? '50';
  const limit = Number(limitText);
  let before = null;
  if (query.before !== undefined) {
    try { before = JSON.parse(query.before); } catch { return null; }
  }
  if (!/^\d{1,2}$/.test(String(limitText)) || !Number.isInteger(limit) || limit < 1 || limit > 50 ||
    (before !== null && (!before || typeof before !== 'object' || Array.isArray(before) ||
      Object.keys(before).sort().join(',') !== 'id,startedAt' || !validTime(before.startedAt) || !ID.test(before.id)))) {
    return null;
  }
  if (before) before.startedAt = new Date(before.startedAt).toISOString();
  return { before, limit };
}

/** Read-only physician access. Every data read and all live authorization checks share one SQLite transaction. */
export function createPhysicianMeasurementSessionRouter(auth, database, { guards = {} } = {}) {
  const router = express.Router();
  const sessions = createMeasurementSessionRepository(database);
  const approved = guards.isPhysicianApprovedInTransaction ?? (() => false);

  async function authenticated(req, res) {
    let result;
    try { result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); }
    catch { res.status(401).json({ error: 'authentication_required' }); return null; }
    if (!result?.user?.id || !result?.session?.id || !result?.session?.token) {
      res.status(401).json({ error: 'authentication_required' });
      return null;
    }
    if (!result.user.emailVerified) {
      res.status(403).json({ error: 'physician_authorization_required' });
      return null;
    }
    return result;
  }

  function readForPhysician(session, patientId, read) {
    try {
      // better-sqlite3 runs this callback synchronously. The transaction is the
      // linearization point: auth/session, approval, proof, relation, and data
      // all come from one SQLite snapshot, with no await inside the callback.
      return database.transaction(() => {
        const current = database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
          WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
          .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
        const context = { user: session.user, session, request: null };
        if (!current || approved(context) !== true || hasFreshTotpProof(database, session.session) !== true) {
          return { kind: 'forbidden' };
        }
        const relation = database.prepare(`SELECT 1 FROM patient_relation
          WHERE physician_user_id = ? AND patient_profile_id = ? AND status = 'active'`)
          .get(session.user.id, patientId);
        if (!relation) return { kind: 'not_found' };
        return { kind: 'ok', value: read() };
      })();
    } catch {
      return { kind: 'forbidden' };
    }
  }

  router.get('/patients/:patientId/measurement-sessions', async (req, res) => {
    if (!ID.test(req.params.patientId)) return res.status(404).json({ error: 'patient_not_found' });
    const page = pagination(req.query);
    if (!page) return res.status(400).json({ error: 'invalid_pagination' });
    const session = await authenticated(req, res);
    if (!session) return;
    const result = readForPhysician(session, req.params.patientId,
      () => sessions.listForProfile(req.params.patientId, page.before, page.limit));
    if (result.kind === 'forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'patient_not_found' });
    return res.json(result.value);
  });

  router.get('/patients/:patientId/measurement-sessions/:sessionId', async (req, res) => {
    if (!ID.test(req.params.patientId) || !ID.test(req.params.sessionId)) {
      return res.status(404).json({ error: 'measurement_session_not_found' });
    }
    const session = await authenticated(req, res);
    if (!session) return;
    const result = readForPhysician(session, req.params.patientId,
      () => sessions.findForProfile(req.params.patientId, req.params.sessionId));
    if (result.kind === 'forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found' || !result.value) return res.status(404).json({ error: 'measurement_session_not_found' });
    return res.json({ session: result.value });
  });

  return router;
}
