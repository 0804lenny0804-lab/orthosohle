import express from 'express';
import { randomUUID } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { hasFreshTotpProof } from './totp-step-up.js';

const MAX_INJURY_LENGTH = 240;
const MAX_WEIGHT_KG = 1_000;

function validPatch(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return false;
  const keys = Object.keys(body).sort();
  if (!keys.includes('expectedVersion') || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) return false;
  const changes = keys.filter(key => key !== 'expectedVersion');
  if (!changes.length || changes.some(key => !['injury', 'weightKg'].includes(key))) return false;
  if (Object.hasOwn(body, 'injury') && body.injury !== null &&
      (typeof body.injury !== 'string' || body.injury.length > MAX_INJURY_LENGTH || !body.injury.trim())) return false;
  if (Object.hasOwn(body, 'weightKg') && body.weightKg !== null &&
      (typeof body.weightKg !== 'number' || !Number.isFinite(body.weightKg) || body.weightKg <= 0 || body.weightKg > MAX_WEIGHT_KG)) return false;
  return true;
}

function profileSelect(database, profileId) {
  const row = database.prepare(`SELECT p.id, p.created_at AS createdAt, p.version, p.injury,
    p.weight_kg AS weightKg, p.updated_at AS updatedAt,
    (SELECT u.name FROM patient_profile_audit a JOIN user u ON u.id = a.actor_user_id
      WHERE a.patient_profile_id = p.id ORDER BY a.profile_version DESC LIMIT 1) AS lastChangedByName
    FROM patient_profile p WHERE p.id = ?`).get(profileId);
  if (!row) return null;
  const { lastChangedByName, ...profile } = row;
  return { ...profile, lastChangedBy: lastChangedByName ? { name: lastChangedByName } : null };
}

function liveSession(database, session) {
  return database.prepare(`SELECT 1 FROM session s JOIN user u ON u.id = s.userId
    WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ? AND u.emailVerified = 1`)
    .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
}

function physicianAllowed(database, session) {
  return Boolean(database.prepare(`SELECT 1 FROM physician_review_application a
    WHERE a.account_user_id = ? AND a.status = 'approved'`).get(session.user.id) &&
    hasFreshTotpProof(database, session.session));
}

/** Mount at /api/patient-profile. Local development entry; 1000 kg is an input safety bound, not a clinical threshold. */
export function createPatientProfileRouter(auth, database, webOrigin) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PATCH') {
      if (req.get('Origin') !== webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'json_required' });
      return express.json({ limit: '2kb', strict: true })(req, res, next);
    }
    return next();
  });

  async function sessionFor(req, res) {
    let session;
    try { session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); }
    catch { res.status(401).json({ error: 'authentication_required' }); return null; }
    if (!session?.user?.id || !session.session?.id || !session.session?.token) {
      res.status(401).json({ error: 'authentication_required' }); return null;
    }
    if (!session.user.emailVerified) { res.status(403).json({ error: 'email_verification_required' }); return null; }
    return session;
  }

  router.get('/', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    const result = database.transaction(() => {
      if (!liveSession(database, session)) return null;
      let profile = database.prepare(`SELECT p.id, p.created_at AS createdAt,
        p.version, p.injury, p.weight_kg AS weightKg, p.updated_at AS updatedAt,
        (SELECT u.name FROM patient_profile_audit a JOIN user u ON u.id = a.actor_user_id
          WHERE a.patient_profile_id = p.id ORDER BY a.profile_version DESC LIMIT 1) AS lastChangedByName
        FROM patient_profile p WHERE p.account_user_id = ?`).get(session.user.id) ?? null;
      if (profile) {
        const { lastChangedByName, ...fields } = profile;
        profile = { ...fields, lastChangedBy: lastChangedByName ? { name: lastChangedByName } : null };
      }
      return { kind: 'ok', profile };
    }).immediate();
    if (!result) return res.status(401).json({ error: 'authentication_required' });
    return res.json({ profile: result.profile });
  });

  router.post('/', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
      return res.status(400).json({ error: 'empty_object_required' });
    }
    const result = database.transaction(() => {
      if (!liveSession(database, session)) return { kind: 'unauthenticated' };
      const existing = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(session.user.id);
      if (existing) return { kind: 'existing', profile: profileSelect(database, existing.id) };
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      database.prepare(`INSERT INTO patient_profile (id, account_user_id, created_at, updated_at)
        VALUES (?, ?, ?, NULL)`).run(id, session.user.id, createdAt);
      return { kind: 'created', profile: profileSelect(database, id) };
    }).immediate();
    if (result.kind === 'unauthenticated') return res.status(401).json({ error: 'authentication_required' });
    return res.status(result.kind === 'created' ? 201 : 200).json({ profile: result.profile });
  });

  function patchInTransaction(session, profileId, body, physician) {
    if (!liveSession(database, session)) return { kind: 'unauthenticated' };
    if (physician && !physicianAllowed(database, session)) return { kind: 'physician_forbidden' };
    const profile = physician
      ? database.prepare(`SELECT p.id, p.version FROM patient_profile p JOIN patient_relation r
          ON r.patient_profile_id = p.id AND r.physician_user_id = ? AND r.status = 'active'
          JOIN physician_review_application a ON a.account_user_id = r.physician_user_id AND a.status = 'approved'
          WHERE p.id = ?`).get(session.user.id, profileId)
      : database.prepare(`SELECT id, version FROM patient_profile WHERE account_user_id = ?`).get(session.user.id);
    if (!profile || (physician && profile.id !== profileId)) return { kind: 'not_found' };
    if (profile.version !== body.expectedVersion) return { kind: 'conflict', currentVersion: profile.version };
    const nextVersion = profile.version + 1;
    const occurredAt = new Date().toISOString();
    const injury = Object.hasOwn(body, 'injury') ? (body.injury === null ? null : body.injury.trim()) : undefined;
    const weight = Object.hasOwn(body, 'weightKg') ? body.weightKg : undefined;
    const changed = database.prepare(`UPDATE patient_profile SET
      injury = CASE WHEN ? THEN ? ELSE injury END,
      weight_kg = CASE WHEN ? THEN ? ELSE weight_kg END,
      version = ?, updated_at = ? WHERE id = ? AND version = ?`)
      .run(injury !== undefined ? 1 : 0, injury ?? null,
        weight !== undefined ? 1 : 0, weight ?? null, nextVersion, occurredAt, profile.id, profile.version);
    if (changed.changes !== 1) return { kind: 'conflict', currentVersion: profileSelect(database, profile.id).version };
    database.prepare(`INSERT INTO patient_profile_audit
      (id, patient_profile_id, actor_user_id, action, occurred_at, profile_version)
      VALUES (?, ?, ?, 'updated', ?, ?)`)
      .run(randomUUID(), profile.id, session.user.id, occurredAt, nextVersion);
    return { kind: 'updated', profile: profileSelect(database, profile.id) };
  }

  router.patch('/', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    if (!validPatch(req.body)) return res.status(400).json({ error: 'invalid_patient_profile' });
    const result = database.transaction(() => patchInTransaction(session, null, req.body, false)).immediate();
    if (result.kind === 'unauthenticated') return res.status(401).json({ error: 'authentication_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'profile_not_found' });
    if (result.kind === 'conflict') return res.status(409).json({ error: 'profile_changed', currentVersion: result.currentVersion });
    return res.json({ profile: result.profile });
  });

  router.get('/physician/:patientProfileId', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    const result = database.transaction(() => {
      if (!liveSession(database, session)) return { kind: 'unauthenticated' };
      if (!physicianAllowed(database, session)) return { kind: 'physician_forbidden' };
      const profile = database.prepare(`SELECT p.id FROM patient_profile p JOIN patient_relation r
        ON r.patient_profile_id = p.id AND r.physician_user_id = ? AND r.status = 'active'
        JOIN physician_review_application a ON a.account_user_id = r.physician_user_id AND a.status = 'approved'
        WHERE p.id = ?`).get(session.user.id, req.params.patientProfileId);
      return profile ? { kind: 'ok', profile: profileSelect(database, profile.id) } : { kind: 'not_found' };
    }).immediate();
    if (result.kind === 'unauthenticated') return res.status(401).json({ error: 'authentication_required' });
    if (result.kind === 'physician_forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'patient_not_found' });
    return res.json({ profile: result.profile });
  });

  router.patch('/physician/:patientProfileId', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    if (!validPatch(req.body)) return res.status(400).json({ error: 'invalid_patient_profile' });
    const result = database.transaction(() => patchInTransaction(session, req.params.patientProfileId, req.body, true)).immediate();
    if (result.kind === 'unauthenticated') return res.status(401).json({ error: 'authentication_required' });
    if (result.kind === 'physician_forbidden') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'patient_not_found' });
    if (result.kind === 'conflict') return res.status(409).json({ error: 'profile_changed', currentVersion: result.currentVersion });
    return res.json({ profile: result.profile });
  });

  return router;
}
