import { randomUUID } from 'node:crypto';
import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';

// The transaction and partial unique index make the one-active-physician rule
// hold even when two independent API requests accept invitations together.
export function migratePatientRelations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS patient_invitation (
      id TEXT PRIMARY KEY NOT NULL,
      physician_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      target_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn', 'expired')),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS patient_invitation_target_status
      ON patient_invitation(target_user_id, status);
    CREATE TABLE IF NOT EXISTS patient_relation (
      id TEXT PRIMARY KEY NOT NULL,
      physician_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      invitation_id TEXT NOT NULL UNIQUE REFERENCES patient_invitation(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS patient_relation_one_active_per_patient
      ON patient_relation(patient_profile_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS patient_relation_active_physician
      ON patient_relation(physician_user_id, patient_profile_id) WHERE status = 'active';
  `);
}

export function createPatientRelationsRepository(database) {
  const findInvitation = database.prepare(`
    SELECT id, physician_user_id AS physicianUserId, patient_profile_id AS patientProfileId,
      target_user_id AS targetUserId, status, created_at AS createdAt, expires_at AS expiresAt
    FROM patient_invitation WHERE id = ?
  `);
  const findActive = database.prepare(`
    SELECT id, physician_user_id AS physicianUserId, patient_profile_id AS patientProfileId,
      started_at AS startedAt
    FROM patient_relation WHERE patient_profile_id = ? AND status = 'active'
  `);
  const endActive = database.prepare(`
    UPDATE patient_relation SET status = 'ended', ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE patient_profile_id = ? AND status = 'active'
  `);
  const createInvitation = database.prepare(`
    INSERT INTO patient_invitation
      (id, physician_user_id, patient_profile_id, target_user_id, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'open', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)
  `);
  const acceptInvitation = database.transaction((invitationId, targetUserId, physicianStillApproved) => {
    const invitation = findInvitation.get(invitationId);
    if (!invitation || invitation.targetUserId !== targetUserId) return { kind: 'not_found' };
    if (invitation.status !== 'open') return { kind: 'not_open' };
    const now = new Date().toISOString();
    if (invitation.expiresAt <= now) {
      database.prepare("UPDATE patient_invitation SET status = 'expired' WHERE id = ? AND status = 'open'").run(invitationId);
      return { kind: 'expired' };
    }
    if (typeof physicianStillApproved !== 'function' || physicianStillApproved(invitation.physicianUserId) !== true) {
      return { kind: 'physician_not_approved' };
    }
    const occupied = findActive.get(invitation.patientProfileId);
    if (occupied?.physicianUserId === invitation.physicianUserId) return { kind: 'already_assigned' };
    // Recheck the physician gate's backing state within the same serialized write.
    const moved = database.prepare("UPDATE patient_invitation SET status = 'accepted' WHERE id = ? AND status = 'open'").run(invitationId);
    if (moved.changes !== 1) return { kind: 'not_open' };
    // Explicit acceptance authorizes a switch. The old relationship is ended
    // atomically; no plan or historical data right is copied to the new one.
    if (occupied) endActive.run(invitation.patientProfileId);
    database.prepare(`INSERT INTO patient_relation
        (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
        VALUES (?, ?, ?, ?, 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .run(randomUUID(), invitation.physicianUserId, invitation.patientProfileId, invitationId);
    return { kind: 'accepted' };
  });
  const declineInvitation = database.transaction((invitationId, targetUserId) => {
    const invitation = findInvitation.get(invitationId);
    if (!invitation || invitation.targetUserId !== targetUserId) return { kind: 'not_found' };
    if (invitation.status !== 'open') return { kind: 'not_open' };
    const now = new Date().toISOString();
    if (invitation.expiresAt <= now) {
      database.prepare("UPDATE patient_invitation SET status = 'expired' WHERE id = ? AND status = 'open'").run(invitationId);
      return { kind: 'expired' };
    }
    const changed = database.prepare("UPDATE patient_invitation SET status = 'declined' WHERE id = ? AND status = 'open'").run(invitationId);
    return changed.changes === 1 ? { kind: 'declined' } : { kind: 'not_open' };
  });

  return {
    createInvitation({ physicianUserId, patientProfileId, targetUserId, expiresAt }) {
      const existing = database.prepare(`SELECT id FROM patient_profile WHERE id = ? AND account_user_id = ?`)
        .get(patientProfileId, targetUserId);
      if (!existing) return { kind: 'target_mismatch' };
      if (findActive.get(patientProfileId)?.physicianUserId === physicianUserId) return { kind: 'already_assigned' };
      const id = randomUUID();
      createInvitation.run(id, physicianUserId, patientProfileId, targetUserId, expiresAt);
      return { kind: 'created', invitation: findInvitation.get(id) };
    },
    findProfileForExactEmail(email) {
      return database.prepare(`SELECT p.id AS patientProfileId, p.account_user_id AS targetUserId,
        u.name AS displayName FROM user u JOIN patient_profile p ON p.account_user_id = u.id
        WHERE u.email = ? AND u.emailVerified = 1`).get(email) ?? null;
    },
    listActiveForPhysician(physicianUserId) {
      return database.prepare(`SELECT r.id AS relationshipId, p.id AS patientId, u.name AS displayName,
        r.status, r.started_at AS startedAt FROM patient_relation r
        JOIN patient_profile p ON p.id = r.patient_profile_id
        JOIN user u ON u.id = p.account_user_id
        WHERE r.physician_user_id = ? AND r.status = 'active' ORDER BY r.started_at, r.id`).all(physicianUserId);
    },
    currentForPatient(targetUserId) {
      const relationship = database.prepare(`SELECT r.id AS relationshipId, u.name AS displayName,
        r.status, r.started_at AS startedAt FROM patient_relation r
        JOIN patient_profile p ON p.id = r.patient_profile_id
        JOIN user u ON u.id = r.physician_user_id
        WHERE p.account_user_id = ? AND r.status = 'active'`).get(targetUserId) ?? null;
      const invitations = database.prepare(`SELECT i.id, u.name AS physicianName,
        i.expires_at AS expiresAt, i.status FROM patient_invitation i
        JOIN user u ON u.id = i.physician_user_id
        WHERE i.target_user_id = ? AND i.status = 'open' ORDER BY i.created_at, i.id`).all(targetUserId);
      return { relationship, invitations };
    },
    acceptInvitation(invitationId, targetUserId, physicianStillApproved) {
      try {
        return acceptInvitation.immediate(invitationId, targetUserId, physicianStillApproved);
      } catch (error) {
        if (String(error.code).startsWith('SQLITE_CONSTRAINT')) return { kind: 'already_assigned' };
        throw error;
      }
    },
    declineInvitation(invitationId, targetUserId) {
      return declineInvitation.immediate(invitationId, targetUserId);
    },
    findActiveForPatient(patientProfileId) { return findActive.get(patientProfileId) ?? null; },
    hasActiveRelationship(physicianUserId, patientProfileId) {
      return Boolean(database.prepare(`SELECT 1 FROM patient_relation
        WHERE physician_user_id = ? AND patient_profile_id = ? AND status = 'active'`)
        .get(physicianUserId, patientProfileId));
    },
    findInvitationForTarget(invitationId, targetUserId) {
      const invite = findInvitation.get(invitationId);
      return invite?.targetUserId === targetUserId ? invite : null;
    },
  };
}

export function createPatientRelationsRouter(auth, database, { webOrigin, invitationLifetimeMs, guards = {} }) {
  const router = express.Router();
  const repository = createPatientRelationsRepository(database);
  const isPhysicianApproved = guards.isPhysicianApprovedInTransaction ?? (() => false);
  const hasPhysicianAssurance = guards.hasPhysicianAssuranceInTransaction ?? (() => false);
  const isPhysicianCurrentlyApproved = guards.isPhysicianCurrentlyApprovedInTransaction ?? (() => false);

  router.use((req, res, next) => {
    if (req.method === 'POST' && req.get('Origin') !== webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'json_required' });
    if (req.method === 'POST') return express.json({ limit: '1kb', strict: true })(req, res, next);
    return next();
  });

  async function sessionFor(req, res) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) { res.status(401).json({ error: 'authentication_required' }); return null; }
    if (!session.user.emailVerified) { res.status(403).json({ error: 'email_verification_required' }); return null; }
    return session;
  }
  function physicianOperation(req, session, operation) {
    try {
      const context = { user: session.user, session, request: req };
      return database.transaction(() => {
        if (isPhysicianApproved(context) !== true || hasPhysicianAssurance(context) !== true) {
          return { kind: 'unauthorized' };
        }
        return { kind: 'ok', value: operation() };
      }).immediate();
    } catch {
      return { kind: 'unauthorized' };
    }
  }

  router.get('/physician/patients', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    const result = physicianOperation(req, session, () => repository.listActiveForPhysician(session.user.id));
    if (result.kind !== 'ok') return res.status(403).json({ error: 'physician_authorization_required' });
    return res.json({ patients: result.value });
  });

  router.get('/patient', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    return res.json(repository.currentForPatient(session.user.id));
  });

  router.post('/invitations', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 ||
      typeof req.body.patientEmail !== 'string' || req.body.patientEmail.length < 3 || req.body.patientEmail.length > 254) {
      return res.status(400).json({ error: 'invalid_invitation' });
    }
    if (!Number.isSafeInteger(invitationLifetimeMs) || invitationLifetimeMs < 1) {
      return res.status(503).json({ error: 'invitation_expiry_not_configured' });
    }
    const expiresAt = new Date(Date.now() + invitationLifetimeMs).toISOString();
    const guarded = physicianOperation(req, session, () => {
      const target = repository.findProfileForExactEmail(req.body.patientEmail);
      if (!target) return { kind: 'target_mismatch' };
      return repository.createInvitation({ physicianUserId: session.user.id,
        patientProfileId: target.patientProfileId, targetUserId: target.targetUserId, expiresAt });
    });
    if (guarded.kind !== 'ok') return res.status(403).json({ error: 'physician_authorization_required' });
    const result = guarded.value;
    if (result.kind === 'already_assigned') return res.status(409).json({ error: 'patient_already_assigned' });
    if (result.kind !== 'created') return res.status(404).json({ error: 'patient_not_found' });
    return res.status(201).json({ invitation: { id: result.invitation.id, expiresAt: result.invitation.expiresAt, status: 'open' } });
  });

  router.post('/invitations/:id/accept', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) return res.status(400).json({ error: 'empty_object_required' });
    const invitation = repository.findInvitationForTarget(req.params.id, session.user.id);
    if (!invitation) return res.status(404).json({ error: 'invitation_not_found' });
    const result = repository.acceptInvitation(req.params.id, session.user.id,
      physicianUserId => isPhysicianCurrentlyApproved({ physicianUserId, database }));
    if (result.kind === 'physician_not_approved') return res.status(403).json({ error: 'physician_authorization_required' });
    if (result.kind === 'not_found') return res.status(404).json({ error: 'invitation_not_found' });
    if (result.kind === 'already_assigned') return res.status(409).json({ error: 'patient_already_assigned' });
    if (result.kind === 'expired') return res.status(409).json({ error: 'invitation_expired' });
    if (result.kind !== 'accepted') return res.status(409).json({ error: 'invitation_not_open' });
    return res.status(201).json({ relationship: repository.findActiveForPatient(
      invitation.patientProfileId) });
  });

  router.post('/invitations/:id/decline', async (req, res) => {
    const session = await sessionFor(req, res);
    if (!session) return;
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
      return res.status(400).json({ error: 'empty_object_required' });
    }
    const result = repository.declineInvitation(req.params.id, session.user.id);
    if (result.kind === 'not_found') return res.status(404).json({ error: 'invitation_not_found' });
    if (result.kind === 'expired') return res.status(409).json({ error: 'invitation_expired' });
    if (result.kind !== 'declined') return res.status(409).json({ error: 'invitation_not_open' });
    return res.json({ invitation: { id: req.params.id, status: 'declined' } });
  });

  return router;
}
