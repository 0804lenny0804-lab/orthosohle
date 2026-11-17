import { randomUUID } from 'node:crypto';

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
