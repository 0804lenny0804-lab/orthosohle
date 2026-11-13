import { randomUUID } from 'node:crypto';

export class PhysicianApprovalRevocationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PhysicianApprovalRevocationError';
    this.code = code;
  }
}

function validOperator(operator) {
  return typeof operator === 'string' && operator.trim().length >= 2
    && operator.length <= 100 && !/[\r\n\0]/.test(operator);
}

function validEmail(email) {
  return typeof email === 'string' && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Local development operator action; no HTTP/admin surface is exposed. */
export function createPhysicianApprovalRevocationRepository(database) {
  const revokeTransaction = database.transaction((operator, targetEmail) => {
    if (!validOperator(operator)) throw new PhysicianApprovalRevocationError('explicit_local_operator_required');
    if (!validEmail(targetEmail)) throw new PhysicianApprovalRevocationError('explicit_target_account_required');

    const target = database.prepare(`
      SELECT id FROM user WHERE lower(email) = lower(?)
    `).get(targetEmail);
    if (!target) throw new PhysicianApprovalRevocationError('target_account_not_found');
    const application = database.prepare(`
      SELECT id, status FROM physician_review_application WHERE account_user_id = ?
    `).get(target.id);
    if (!application) throw new PhysicianApprovalRevocationError('physician_application_not_found');
    if (application.status === 'revoked') return { changed: false, status: 'revoked' };
    if (!['pending', 'approved'].includes(application.status)) {
      throw new PhysicianApprovalRevocationError('physician_application_status_invalid');
    }

    const occurredAt = new Date().toISOString();
    const changed = database.prepare(`
      UPDATE physician_review_application SET status = 'revoked'
      WHERE id = ? AND status IN ('pending', 'approved')
    `).run(application.id);
    if (changed.changes !== 1) throw new PhysicianApprovalRevocationError('physician_application_status_changed');

    database.prepare(`
      UPDATE physician_review_approval_token SET consumed_at = COALESCE(consumed_at, ?)
      WHERE application_id = ? AND consumed_at IS NULL
    `).run(occurredAt, application.id);
    // Better Auth session deletion and the status transition commit together.
    database.prepare('DELETE FROM session WHERE userId = ?').run(target.id);

    const auditId = randomUUID();
    database.prepare(`
      INSERT INTO physician_review_approval_audit
        (id, application_id, reviewer_user_id, target_user_id, operator, action, result, evidence_reference, occurred_at)
      VALUES (?, ?, NULL, ?, ?, 'revoke', 'revoked', ?, ?)
    `).run(auditId, application.id, target.id, operator.trim(), `local-operator-cli:${auditId}`, occurredAt);
    return { changed: true, status: 'revoked' };
  });

  return {
    revoke(operator, targetEmail) {
      return revokeTransaction.immediate(operator, targetEmail);
    },
  };
}
