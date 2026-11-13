import { randomUUID } from 'node:crypto';
import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { hasFreshTotpProof } from './totp-step-up.js';

const MAX_LIMIT_KG = 1_000_000;
const MAX_DECIMAL_PLACES = 3;

/** Repeatable schema-only migration; existing patient and relation rows are untouched. */
export function migrateTherapyPlans(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS therapy_plan_version (
      id TEXT PRIMARY KEY NOT NULL,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      relationship_id TEXT NOT NULL REFERENCES patient_relation(id) ON DELETE RESTRICT,
      physician_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
      version INTEGER NOT NULL CHECK (version > 0),
      limit_kg REAL NOT NULL CHECK (limit_kg > 0 AND limit_kg <= 1000000),
      created_at TEXT NOT NULL,
      UNIQUE (patient_profile_id, version)
    );
    CREATE INDEX IF NOT EXISTS therapy_plan_version_patient_history
      ON therapy_plan_version(patient_profile_id, version DESC);
    CREATE TABLE IF NOT EXISTS therapy_plan_confirmation (
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      plan_version_id TEXT NOT NULL REFERENCES therapy_plan_version(id) ON DELETE RESTRICT,
      confirmed_at TEXT NOT NULL,
      PRIMARY KEY (patient_profile_id, plan_version_id)
    );
    CREATE TABLE IF NOT EXISTS therapy_plan_audit (
      id TEXT PRIMARY KEY NOT NULL,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
      plan_version_id TEXT NOT NULL REFERENCES therapy_plan_version(id) ON DELETE RESTRICT,
      action TEXT NOT NULL CHECK (action IN ('created', 'confirmed')),
      occurred_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS therapy_plan_version_no_update
      BEFORE UPDATE ON therapy_plan_version
      BEGIN SELECT RAISE(ABORT, 'therapy plan versions are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS therapy_plan_version_no_delete
      BEFORE DELETE ON therapy_plan_version
      BEGIN SELECT RAISE(ABORT, 'therapy plan versions are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS therapy_plan_confirmation_no_update
      BEFORE UPDATE ON therapy_plan_confirmation
      BEGIN SELECT RAISE(ABORT, 'therapy plan confirmations are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS therapy_plan_confirmation_no_delete
      BEFORE DELETE ON therapy_plan_confirmation
      BEGIN SELECT RAISE(ABORT, 'therapy plan confirmations are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS therapy_plan_audit_no_update
      BEFORE UPDATE ON therapy_plan_audit
      BEGIN SELECT RAISE(ABORT, 'therapy plan audit is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS therapy_plan_audit_no_delete
      BEFORE DELETE ON therapy_plan_audit
      BEGIN SELECT RAISE(ABORT, 'therapy plan audit is immutable'); END;
  `);
}

export function createTherapyPlanRepository(database) {
  const readPlan = database.prepare(`SELECT v.id, v.patient_profile_id AS patientId, v.relationship_id AS relationshipId,
    v.physician_user_id AS authoredBy, u.name AS authorName, v.version, v.limit_kg AS limitKg, 'kg' AS unit,
    v.created_at AS createdAt FROM therapy_plan_version v JOIN user u ON u.id = v.physician_user_id WHERE v.id = ?`);

  const createVersion = database.transaction((patientProfileId, physicianUserId, limitKg, expectedVersion) => {
    const activeRelation = database.prepare(`SELECT id FROM patient_relation
      WHERE patient_profile_id = ? AND physician_user_id = ? AND status = 'active'`)
      .get(patientProfileId, physicianUserId);
    if (!activeRelation) return { kind: 'not_related' };
    const currentVersion = database.prepare(`SELECT MAX(version) AS currentVersion
      FROM therapy_plan_version WHERE relationship_id = ?`)
      .get(activeRelation.id).currentVersion ?? null;
    if (currentVersion !== expectedVersion) return { kind: 'stale_version', currentVersion };
    const version = database.prepare(`SELECT COALESCE(MAX(version), 0) + 1 AS nextVersion
      FROM therapy_plan_version WHERE patient_profile_id = ?`).get(patientProfileId).nextVersion;
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    database.prepare(`INSERT INTO therapy_plan_version
      (id, patient_profile_id, relationship_id, physician_user_id, version, limit_kg, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, patientProfileId, activeRelation.id, physicianUserId, version, limitKg, createdAt);
    database.prepare(`INSERT INTO therapy_plan_audit (id, patient_profile_id, actor_user_id, plan_version_id, action, occurred_at)
      VALUES (?, ?, ?, ?, 'created', ?)`).run(randomUUID(), patientProfileId, physicianUserId, id, createdAt);
    return { kind: 'created', plan: readPlan.get(id) };
  });

  const currentForPatient = database.prepare(`SELECT v.id, v.patient_profile_id AS patientId,
    v.relationship_id AS relationshipId, v.physician_user_id AS authoredBy, u.name AS authorName,
    v.version, v.limit_kg AS limitKg, 'kg' AS unit,
    v.created_at AS createdAt, c.confirmed_at AS confirmedAt
    FROM patient_profile p
    JOIN patient_relation r ON r.patient_profile_id = p.id AND r.status = 'active'
    JOIN physician_review_application a ON a.account_user_id = r.physician_user_id AND a.status = 'approved'
    JOIN therapy_plan_version v ON v.relationship_id = r.id
      AND v.version = (SELECT MAX(v2.version) FROM therapy_plan_version v2 WHERE v2.relationship_id = r.id)
    JOIN user u ON u.id = v.physician_user_id
    LEFT JOIN therapy_plan_confirmation c ON c.patient_profile_id = p.id AND c.plan_version_id = v.id
    WHERE p.account_user_id = ?`);

  const confirm = database.transaction((patientUserId, versionId) => {
    const plan = database.prepare(`SELECT v.id, v.patient_profile_id AS patientId,
      v.relationship_id AS relationshipId, v.physician_user_id AS authoredBy, u.name AS authorName,
      v.version, v.limit_kg AS limitKg, 'kg' AS unit,
      v.created_at AS createdAt FROM therapy_plan_version v
      JOIN patient_profile p ON p.id = v.patient_profile_id AND p.account_user_id = ?
      JOIN patient_relation r ON r.patient_profile_id = p.id AND r.id = v.relationship_id AND r.physician_user_id = v.physician_user_id
        AND r.status = 'active'
      JOIN physician_review_application a ON a.account_user_id = r.physician_user_id AND a.status = 'approved'
      JOIN user u ON u.id = v.physician_user_id
      WHERE v.id = ? AND v.version = (SELECT MAX(v2.version) FROM therapy_plan_version v2
        WHERE v2.relationship_id = r.id)`)
      .get(patientUserId, versionId);
    if (!plan) return { kind: 'not_current' };
    const existing = database.prepare(`SELECT confirmed_at AS confirmedAt FROM therapy_plan_confirmation
      WHERE patient_profile_id = ? AND plan_version_id = ?`).get(plan.patientId, plan.id);
    if (existing) return { kind: 'confirmed', confirmation: { versionId: plan.id, confirmedAt: existing.confirmedAt, alreadyConfirmed: true } };
    const confirmedAt = new Date().toISOString();
    database.prepare(`INSERT INTO therapy_plan_confirmation (patient_profile_id, plan_version_id, confirmed_at)
      VALUES (?, ?, ?)`).run(plan.patientId, plan.id, confirmedAt);
    database.prepare(`INSERT INTO therapy_plan_audit (id, patient_profile_id, actor_user_id, plan_version_id, action, occurred_at)
      VALUES (?, ?, ?, ?, 'confirmed', ?)`).run(randomUUID(), plan.patientId, patientUserId, plan.id, confirmedAt);
    return { kind: 'confirmed', confirmation: { versionId: plan.id, confirmedAt, alreadyConfirmed: false } };
  });

  return {
    history(patientProfileId) {
      return database.prepare(`SELECT v.id, v.patient_profile_id AS patientId,
        v.relationship_id AS relationshipId, v.physician_user_id AS authoredBy,
        v.version, v.limit_kg AS limitKg, 'kg' AS unit, u.name AS authorName,
        v.created_at AS createdAt FROM therapy_plan_version v JOIN user u ON u.id = v.physician_user_id
        WHERE v.patient_profile_id = ? ORDER BY v.created_at DESC, v.version DESC`)
        .all(patientProfileId);
    },
    createVersion(patientProfileId, physicianUserId, limitKg, expectedVersion) {
      return createVersion.immediate(patientProfileId, physicianUserId, limitKg, expectedVersion);
    },
    currentForPatient(userId) {
      const current = currentForPatient.get(userId);
      if (!current) {
        const profile = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(userId);
        const previous = profile && database.prepare('SELECT 1 FROM therapy_plan_version WHERE patient_profile_id = ? LIMIT 1').get(profile.id);
        const relationship = profile && database.prepare(`SELECT r.id AS relationshipId,
          r.physician_user_id AS physicianUserId, r.status, a.status AS physicianApprovalStatus
          FROM patient_relation r LEFT JOIN physician_review_application a ON a.account_user_id = r.physician_user_id
          WHERE r.patient_profile_id = ? AND r.status = 'active'`).get(profile.id);
        return { plan: null, confirmedAt: null, relationship: relationship ?? null,
          previousPlanStatus: previous ? 'continuation_undetermined' : null };
      }
      const { confirmedAt, ...plan } = current;
      return { plan, confirmedAt: confirmedAt ?? null,
        relationship: { relationshipId: current.relationshipId, physicianUserId: current.authoredBy, status: 'active', physicianApprovalStatus: 'approved' },
        previousPlanStatus: null };
    },
    confirm(patientUserId, versionId) { return confirm.immediate(patientUserId, versionId); },
  };
}

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
