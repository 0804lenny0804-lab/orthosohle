import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { hasPhysicianTotpProof } from '../sign-in/recent-totp-check.js';

const ID = /^[0-9a-f-]{36}$/i;
const MAX_COMMENT_LENGTH = 500;

function parseFeedback(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return null;
  const allowed = ['comment', 'expectedVersion', 'rating'];
  if (Object.keys(body).some(key => !allowed.includes(key)) ||
      !['rating', 'expectedVersion'].every(key => Object.hasOwn(body, key)) ||
      !['good', 'medium', 'bad'].includes(body.rating)) return null;
  if (body.expectedVersion !== null && (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1)) return null;
  let comment = null;
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string' || body.comment.length > MAX_COMMENT_LENGTH) return null;
    comment = body.comment.trim() || null;
    if (comment?.length > MAX_COMMENT_LENGTH) return null;
  }
  return { rating: body.rating, comment, expectedVersion: body.expectedVersion };
}

function feedbackRow(row) {
  if (!row) return null;
  return { rating: row.rating, comment: row.comment, version: row.version,
    createdAt: row.createdAt, updatedAt: row.updatedAt };
}

/** Patient-owned feedback and physician read access under the established live gates. */
export function createMeasurementFeedbackRouter(auth, database, { webOrigin, guards = {} }) {
  if (!auth?.api?.getSession || !database?.prepare || typeof webOrigin !== 'string') {
    throw new TypeError('Measurement feedback dependencies are required');
  }
  const router = express.Router();
  const approved = guards.isPhysicianApprovedInTransaction ?? (() => false);
  router.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    if (req.get('Origin') !== webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'json_required' });
    return express.json({ limit: '2kb', strict: true })(req, res, next);
  });

  async function authenticated(req, res) {
    let value;
    try { value = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); }
    catch { res.status(401).json({ error: 'authentication_required' }); return null; }
    if (!value?.user?.id || !value?.session?.id || !value?.session?.token) {
      res.status(401).json({ error: 'authentication_required' }); return null;
    }
    if (!value.user.emailVerified) { res.status(403).json({ error: 'email_verification_required' }); return null; }
    return value;
  }

  function patientContext(session, sessionId, operation) {
    return database.transaction(() => {
      const current = database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
        WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
        .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
      if (!current) return { kind: 'unauthenticated' };
      const profile = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(session.user.id);
      if (!profile) return { kind: 'profile_missing' };
      const measurement = database.prepare(`SELECT source, status FROM measurement_session
        WHERE id = ? AND patient_profile_id = ?`).get(sessionId, profile.id);
      if (!measurement) return { kind: 'not_found' };
      if (measurement.source !== 'ble' || measurement.status !== 'completed') return { kind: 'not_feedback_session' };
      return operation(profile.id);
    }).immediate();
  }

  const findFeedback = database.prepare(`SELECT rating, comment, version, created_at AS createdAt,
    updated_at AS updatedAt FROM measurement_feedback WHERE measurement_session_id = ? AND patient_profile_id = ?`);
  const insertFeedback = database.prepare(`INSERT INTO measurement_feedback
    (measurement_session_id, patient_profile_id, rating, comment, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
  const updateFeedback = database.prepare(`UPDATE measurement_feedback SET rating = ?, comment = ?,
    version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE measurement_session_id = ? AND patient_profile_id = ? AND version = ?`);

  router.get('/:sessionId', async (req, res) => {
    if (!ID.test(req.params.sessionId)) return res.status(404).json({ error: 'measurement_session_not_found' });
    const session = await authenticated(req, res);
    if (!session) return;
    let result;
    try {
      result = patientContext(session, req.params.sessionId, profileId => ({ kind: 'ok', feedback: feedbackRow(findFeedback.get(req.params.sessionId, profileId)) }));
    } catch { return res.status(401).json({ error: 'authentication_required' }); }
    if (result.kind === 'unauthenticated') return res.status(401).json({ error: 'authentication_required' });
    if (result.kind === 'profile_missing') return res.status(403).json({ error: 'patient_profile_required' });
    if (result.kind !== 'ok') return res.status(404).json({ error: 'measurement_session_not_found' });
    return res.json({ feedback: result.feedback });
  });

  router.post('/:sessionId', async (req, res) => {
    if (!ID.test(req.params.sessionId)) return res.status(404).json({ error: 'measurement_session_not_found' });
    const input = parseFeedback(req.body);
    if (!input) return res.status(400).json({ error: 'invalid_feedback' });
    const session = await authenticated(req, res);
    if (!session) return;
    let result;
    try {
      result = patientContext(session, req.params.sessionId, profileId => {
        const existing = findFeedback.get(req.params.sessionId, profileId);
        if (!existing) {
          if (input.expectedVersion !== null) return { kind: 'version_conflict' };
          insertFeedback.run(req.params.sessionId, profileId, input.rating, input.comment);
          return { kind: 'created', feedback: feedbackRow(findFeedback.get(req.params.sessionId, profileId)) };
        }
        // Replaying the current value is safe even if its original precondition is old.
        if (existing.rating === input.rating && existing.comment === input.comment) {
          return { kind: 'unchanged', feedback: feedbackRow(existing) };
        }
        if (input.expectedVersion !== existing.version) return { kind: 'version_conflict' };
        if (updateFeedback.run(input.rating, input.comment, req.params.sessionId, profileId, existing.version).changes !== 1) {
          return { kind: 'version_conflict' };
        }
        return { kind: 'updated', feedback: feedbackRow(findFeedback.get(req.params.sessionId, profileId)) };
      });
    } catch { return res.status(401).json({ error: 'authentication_required' }); }
    if (result.kind === 'unauthenticated') return res.status(401).json({ error: 'authentication_required' });
    if (result.kind === 'profile_missing') return res.status(403).json({ error: 'patient_profile_required' });
    if (result.kind === 'not_feedback_session') return res.status(409).json({ error: 'feedback_requires_ble_session' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'measurement_session_not_found' });
    if (result.kind === 'version_conflict') return res.status(409).json({ error: 'feedback_version_conflict' });
    return res.status(result.kind === 'created' ? 201 : 200).json({ feedback: result.feedback });
  });

  router.get('/physician/patients/:patientId/measurement-sessions/:sessionId', async (req, res) => {
    if (!ID.test(req.params.patientId) || !ID.test(req.params.sessionId)) return res.status(404).json({ error: 'measurement_session_not_found' });
    const session = await authenticated(req, res);
    if (!session) return;
    let result;
    try {
      result = database.transaction(() => {
        const now = new Date().toISOString();
        const current = database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
          WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
          .get(session.session.id, session.user.id, session.session.token, now);
        const context = { user: session.user, session, request: req };
        if (!current || approved(context) !== true || !hasPhysicianTotpProof(database, session.session, Date.now())) return { kind: 'forbidden' };
        const relation = database.prepare(`SELECT 1 FROM patient_relation
          WHERE physician_user_id = ? AND patient_profile_id = ? AND status = 'active'`)
          .get(session.user.id, req.params.patientId);
        if (!relation) return { kind: 'not_found' };
        const ownsSession = database.prepare(`SELECT 1 FROM measurement_session
          WHERE id = ? AND patient_profile_id = ? AND source = 'ble' AND status = 'completed'`)
          .get(req.params.sessionId, req.params.patientId);
        if (!ownsSession) return { kind: 'not_found' };
        return { kind: 'ok', feedback: feedbackRow(findFeedback.get(req.params.sessionId, req.params.patientId)) };
      })();
    } catch { return res.status(403).json({ error: 'physician_authorization_required' }); }
    if (result.kind === 'forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'measurement_session_not_found' });
    return res.json({ feedback: result.feedback });
  });

  return router;
}
