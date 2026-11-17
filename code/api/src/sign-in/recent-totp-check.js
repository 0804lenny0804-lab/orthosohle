import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PROOF_TTL_MS = 5 * 60 * 1000;
const CODE_RE = /^\d{6,8}$/;

/** Check current DB state; pass the session returned by Better Auth. */
export function hasFreshTotpProof(database, session, now = Date.now()) {
  try {
    if (!session || typeof session.id !== 'string' || typeof session.userId !== 'string' || typeof session.token !== 'string') return false;
    return !!database.prepare(`
      SELECT 1 FROM session s JOIN user u ON u.id = s.userId
        JOIN twoFactor tf ON tf.userId = u.id
        JOIN totp_step_up_attempt p ON p.user_id = u.id AND p.session_id = s.id
      WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ?
        AND u.twoFactorEnabled = 1 AND tf.verified = 1
        AND p.verified_at IS NOT NULL AND p.expires_at > ?
    `).get(session.id, session.userId, session.token, new Date(now).toISOString(), now);
  } catch {
    return false;
  }
}

/**
 * Installs POST /verify and POST /guard for short-lived TOTP step-up.
 * The Better Auth session id is taken from getSession and cross-checked with
 * SQLite; no client-supplied identity or session token is accepted.
 */
export function createTotpStepUpRouter(auth, database, { webOrigin }) {
  if (!auth?.api?.verifyTOTP || !database?.prepare || typeof webOrigin !== 'string') {
    throw new TypeError('TOTP step-up dependencies are required');
  }
  const router = express.Router();
  const findSession = database.prepare(`
    SELECT s.id, s.userId, s.token, s.expiresAt, u.twoFactorEnabled,
      tf.verified AS factorVerified
    FROM session s JOIN user u ON u.id = s.userId
    JOIN twoFactor tf ON tf.userId = u.id
    WHERE s.id = ? AND s.userId = ? AND s.token = ?
      AND s.expiresAt > ? AND u.twoFactorEnabled = 1 AND tf.verified = 1
  `);
  const charge = database.prepare(`
    INSERT INTO totp_step_up_attempt(session_id,user_id,window_started_at,attempts)
    VALUES(?,?,?,1)
    ON CONFLICT(user_id) DO UPDATE SET
      session_id = excluded.session_id,
      attempts = CASE WHEN totp_step_up_attempt.window_started_at <= ? THEN 1 ELSE totp_step_up_attempt.attempts + 1 END,
      window_started_at = CASE WHEN totp_step_up_attempt.window_started_at <= ? THEN ? ELSE totp_step_up_attempt.window_started_at END,
      generation = totp_step_up_attempt.generation + 1,
      verified_at = NULL, expires_at = NULL
    WHERE totp_step_up_attempt.window_started_at <= ? OR totp_step_up_attempt.attempts < ?
  `);
  // The table intentionally stores no session token. Successful proof writes
  // are guarded by a fresh authoritative session/factor read in the transaction.
  const setVerified = database.prepare(`
    UPDATE totp_step_up_attempt SET verified_at = ?, expires_at = ?
    WHERE session_id = ? AND user_id = ? AND generation = ?
  `);
  const getGeneration = database.prepare('SELECT generation FROM totp_step_up_attempt WHERE user_id = ? AND session_id = ?');
  const chargeTx = database.transaction((session, now) => {
    if (!findSession.get(session.id, session.userId, session.token, new Date(now).toISOString())) return 'invalid';
    if (charge.run(session.id, session.userId, now, now - WINDOW_MS, now - WINDOW_MS, now,
      now - WINDOW_MS, MAX_ATTEMPTS).changes !== 1) return { kind: 'limited' };
    return { kind: 'charged', generation: getGeneration.get(session.userId, session.id).generation };
  });
  const verifyTx = database.transaction((session, generation, now) => {
    if (!findSession.get(session.id, session.userId, session.token, new Date(now).toISOString())) return false;
    return setVerified.run(now, now + PROOF_TTL_MS, session.id, session.userId, generation).changes === 1;
  });

  router.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    if (req.get('Origin') !== webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'json_required' });
    return express.json({ limit: '1kb', strict: true })(req, res, next);
  });

  async function current(req) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return null;
    const id = session.session?.id;
    if (typeof id !== 'string' || !id) return null;
    const row = database.prepare('SELECT id, userId, token, expiresAt FROM session WHERE id = ? AND userId = ?')
      .get(id, session.user.id);
    if (!row || row.token !== session.session.token) return null;
    return { id: row.id, userId: row.userId, token: row.token };
  }

  router.post('/verify', async (req, res) => {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 ||
      typeof req.body.code !== 'string' || !CODE_RE.test(req.body.code)) {
      return res.status(400).json({ error: 'invalid_totp_code' });
    }
    let session;
    try { session = await current(req); } catch { return res.status(401).json({ error: 'authentication_required' }); }
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    const now = Date.now();
    try {
      const charged = chargeTx(session, now);
      if (charged === 'invalid') return res.status(401).json({ error: 'authentication_required' });
      if (charged.kind === 'limited') return res.status(429).json({ error: 'step_up_rate_limited' });
      // The installed Better Auth endpoint is the sole TOTP verifier. Its
      // successful response is required before issuing our session-bound proof.
      const verified = await auth.api.verifyTOTP({ body: { code: req.body.code }, headers: fromNodeHeaders(req.headers) });
      if (!verified || verified.token !== session.token || verified.user?.id !== session.userId) {
        return res.status(401).json({ error: 'totp_verification_failed' });
      }
      if (!verifyTx(session, charged.generation, Date.now())) return res.status(401).json({ error: 'session_or_factor_changed' });
      return res.json({ verified: true, expiresInSeconds: PROOF_TTL_MS / 1000 });
    } catch {
      return res.status(401).json({ error: 'totp_verification_failed' });
    }
  });

  router.post('/guard', async (req, res) => {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) return res.status(400).json({ error: 'empty_object_required' });
    let session;
    try { session = await current(req); } catch { return res.status(401).json({ error: 'authentication_required' }); }
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    try {
      const now = Date.now();
      const valid = database.transaction(() => hasFreshTotpProof(database, session, now))();
      return valid ? res.json({ authorized: true }) : res.status(403).json({ error: 'fresh_totp_required' });
    } catch {
      return res.status(403).json({ error: 'fresh_totp_required' });
    }
  });
  return router;
}
