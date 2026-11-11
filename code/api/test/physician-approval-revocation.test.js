import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import test from 'node:test';
import { migratePhysicianApproval } from '../src/physician-approval-migration.js';
import { createPhysicianApprovalRevocationRepository } from '../src/physician-approval-revocation.js';
import { createPhysicianApprovalService } from '../src/physician-approval-service.js';

function fixture(status = 'approved', { legacyAudit = false } = {}) {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id), token TEXT NOT NULL, expiresAt TEXT NOT NULL);
    CREATE TABLE physician_review_application (
      id TEXT PRIMARY KEY NOT NULL,
      account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
      requested_at TEXT NOT NULL
    );
    CREATE TABLE physician_review_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      application_id TEXT NOT NULL UNIQUE REFERENCES physician_review_application(id) ON DELETE RESTRICT,
      recipient_email TEXT NOT NULL, applicant_email TEXT NOT NULL,
      created_at TEXT NOT NULL, materialized_at TEXT
    );
    CREATE TABLE patient_relation (
      id TEXT PRIMARY KEY, physician_user_id TEXT NOT NULL REFERENCES user(id),
      patient_profile_id TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT
    );
    INSERT INTO user VALUES ('physician', 'doctor@example.invalid', 'Doctor'), ('patient', 'patient@example.invalid', 'Patient'), ('reviewer', 'reviewer@example.invalid', 'Reviewer');
    INSERT INTO physician_review_application VALUES ('application', 'physician', '${status}', '2026-01-01T00:00:00.000Z');
    INSERT INTO physician_review_outbox VALUES ('outbox', 'application', 'doctor@example.invalid', 'doctor@example.invalid', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z');
    INSERT INTO session VALUES ('old-session', 'physician', 'session-secret', '2099-01-01T00:00:00.000Z');
    INSERT INTO patient_relation VALUES ('relationship', 'physician', 'profile', 'active', '2026-01-02T00:00:00.000Z', NULL);
  `);
  if (legacyAudit) {
    database.exec(`
      CREATE TABLE physician_review_approval_token (
        id TEXT PRIMARY KEY NOT NULL, application_id TEXT NOT NULL REFERENCES physician_review_application(id) ON DELETE RESTRICT,
        reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
        token_digest TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        consumed_at TEXT, recipient_email TEXT NOT NULL, materialized_at TEXT
      );
      CREATE TABLE physician_review_approval_audit (
        id TEXT PRIMARY KEY NOT NULL, application_id TEXT NOT NULL REFERENCES physician_review_application(id) ON DELETE RESTRICT,
        reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
        action TEXT NOT NULL CHECK (action = 'approve'), result TEXT NOT NULL CHECK (result = 'approved'),
        evidence_reference TEXT NOT NULL, occurred_at TEXT NOT NULL
      );
      INSERT INTO physician_review_approval_token
        (id, application_id, reviewer_user_id, token_digest, created_at, expires_at, recipient_email)
        VALUES ('legacy-token', 'application', 'physician', 'legacy-digest', '2026-01-01T00:00:00.000Z',
          '2099-01-01T00:00:00.000Z', 'doctor@example.invalid');
      INSERT INTO physician_review_approval_audit
        VALUES ('legacy-audit', 'application', 'reviewer', 'approve', 'approved', 'legacy-evidence', '2026-01-01T00:00:00.000Z');
    `);
  }
  migratePhysicianApproval(database);
  if (!legacyAudit) {
    database.prepare(`INSERT INTO physician_review_approval_token
      (id, application_id, reviewer_user_id, token_digest, created_at, expires_at, recipient_email)
      VALUES ('token', 'application', 'physician', 'stored-digest', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', 'doctor@example.invalid')`).run();
  }
  return database;
}

test('local revoke atomically blocks live approval guard, revokes old sessions and tokens, preserves relationship history, and audits target/operator', () => {
  const database = fixture();
  try {
    const repository = createPhysicianApprovalRevocationRepository(database);
    assert.deepEqual(repository.revoke('Local operator', 'DOCTOR@example.invalid'), { changed: true, status: 'revoked' });
    assert.equal(database.prepare('SELECT status FROM physician_review_application').get().status, 'revoked');
    assert.equal(database.prepare('SELECT count(*) AS count FROM session WHERE userId = ?').get('physician').count, 0);
    assert.ok(database.prepare('SELECT consumed_at FROM physician_review_approval_token').get().consumed_at);
    assert.equal(database.prepare('SELECT status FROM patient_relation WHERE id = ?').get('relationship').status, 'active');
    const authorized = database.prepare(`SELECT 1 FROM physician_review_application
      WHERE account_user_id = ? AND status = 'approved'`).get('physician');
    assert.equal(authorized, undefined);
    assert.deepEqual(database.prepare(`SELECT operator, reviewer_user_id AS reviewer, target_user_id AS target, action, result, evidence_reference
      FROM physician_review_approval_audit`).get(), {
      operator: 'Local operator', reviewer: null, target: 'physician', action: 'revoke', result: 'revoked',
      evidence_reference: database.prepare('SELECT evidence_reference FROM physician_review_approval_audit').get().evidence_reference,
    });
    assert.match(database.prepare('SELECT evidence_reference FROM physician_review_approval_audit').get().evidence_reference, /^local-operator-cli:/);
    assert.deepEqual(repository.revoke('Local operator', 'doctor@example.invalid'), { changed: false, status: 'revoked' });
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
    const approval = createPhysicianApprovalService(database, { secret: 'test-secret-with-enough-characters-to-be-safe' });
    assert.equal(approval.issueForApplication('application', 'reviewer-id', 'reviewer@example.invalid'), null);
  } finally { database.close(); }
});

test('failed audit insertion rolls back status, token consumption, and session revocation', () => {
  const database = fixture();
  try {
    database.exec(`CREATE TRIGGER fail_revoke_audit BEFORE INSERT ON physician_review_approval_audit
      WHEN NEW.action = 'revoke' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;`);
    const repository = createPhysicianApprovalRevocationRepository(database);
    assert.throws(() => repository.revoke('Local operator', 'doctor@example.invalid'), /synthetic audit failure/);
    assert.equal(database.prepare('SELECT status FROM physician_review_application').get().status, 'approved');
    assert.equal(database.prepare('SELECT count(*) AS count FROM session WHERE userId = ?').get('physician').count, 1);
    assert.equal(database.prepare('SELECT consumed_at FROM physician_review_approval_token').get().consumed_at, null);
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 0);
  } finally { database.close(); }
});

test('pending applications can be revoked without granting rights; invalid or unknown targets fail closed', () => {
  const database = fixture('pending');
  try {
    const repository = createPhysicianApprovalRevocationRepository(database);
    assert.throws(() => repository.revoke('', 'doctor@example.invalid'), error => error.code === 'explicit_local_operator_required');
    assert.throws(() => repository.revoke('Operator', 'missing@example.invalid'), error => error.code === 'target_account_not_found');
    assert.deepEqual(repository.revoke('Operator', 'doctor@example.invalid'), { changed: true, status: 'revoked' });
    assert.equal(database.prepare('SELECT status FROM physician_review_application').get().status, 'revoked');
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
  } finally { database.close(); }
});

test('migration upgrades pending and approved rows with dependent audit/token data and remains idempotent', () => {
  const database = fixture('approved', { legacyAudit: true });
  const pendingDatabase = fixture('pending');
  try {
    database.exec(`
      CREATE TABLE legacy_application (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      INSERT INTO legacy_application VALUES ('legacy', 'approved');
    `);
    migratePhysicianApproval(database);
    migratePhysicianApproval(database);
    assert.equal(database.prepare('SELECT status FROM physician_review_application').get().status, 'approved');
    assert.equal(database.prepare('SELECT id FROM physician_review_approval_token').get().id, 'legacy-token');
    assert.equal(database.prepare('SELECT operator FROM physician_review_approval_audit').get().operator, 'system:prior-local-approval');
    assert.equal(database.prepare('SELECT reviewer_user_id, target_user_id FROM physician_review_approval_audit').get().reviewer_user_id, 'reviewer');
    assert.equal(database.prepare('SELECT target_user_id FROM physician_review_approval_audit').get().target_user_id, 'physician');
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
    assert.throws(() => database.prepare("UPDATE physician_review_application SET status = 'other'").run(), /CHECK constraint/);
    assert.deepEqual(database.pragma('foreign_key_check'), []);
    assert.deepEqual(pendingDatabase.pragma('foreign_key_check'), []);
    migratePhysicianApproval(pendingDatabase);
    assert.equal(pendingDatabase.prepare('SELECT status FROM physician_review_application').get().status, 'pending');
    assert.deepEqual(pendingDatabase.pragma('foreign_key_check'), []);
  } finally { database.close(); pendingDatabase.close(); }
});
