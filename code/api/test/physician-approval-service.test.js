import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import test from 'node:test';
import { migratePhysicianApproval } from '../src/physician-approval-migration.js';
import { createPhysicianApprovalService } from '../src/physician-approval-service.js';

const secret = 'physician-approval-test-secret-with-sufficient-entropy';
const reviewer = { userId: 'reviewer', sessionId: 'active-session' };

function setup() {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, name TEXT);
    CREATE TABLE physician_review_application (
      id TEXT PRIMARY KEY NOT NULL,
      account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK (status = 'pending'), requested_at TEXT NOT NULL
    );
    CREATE TABLE physician_review_outbox (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL UNIQUE
        REFERENCES physician_review_application(id) ON DELETE RESTRICT,
      recipient_email TEXT NOT NULL, applicant_email TEXT NOT NULL,
      created_at TEXT NOT NULL, materialized_at TEXT
    );
    INSERT INTO user (id, email, name) VALUES
      ('patient', 'patient@example.invalid', 'Patient Example'),
      ('reviewer', 'reviewer@example.invalid', 'Reviewer Example'),
      ('other', 'other@example.invalid', 'Other Example');
    INSERT INTO physician_review_application VALUES ('application', 'patient', 'pending', '2026-01-01T00:00:00.000Z');
    INSERT INTO physician_review_outbox VALUES ('outbox', 'application', 'notify@example.invalid', 'patient@example.invalid', '2026-01-01T00:00:00.000Z', NULL);
  `);
  migratePhysicianApproval(database);
  return database;
}

function service(database, { now = () => Date.parse('2026-01-02T00:00:00.000Z'), guards = {} } = {}) {
  return createPhysicianApprovalService(database, {
    secret,
    authorizeReviewer: guards.authorizeReviewer ?? (() => true),
    hasCurrentSessionMfa: guards.hasCurrentSessionMfa ?? (() => true),
    now,
    lifetimeMs: 1_000,
  });
}

function issue(approval) {
  return approval.issueForApplication('application', reviewer.userId, 'reviewer@example.invalid');
}

test('migration retains existing request and materialized outbox and is repeatable', () => {
  const database = setup();
  try {
    migratePhysicianApproval(database);
    assert.equal(database.prepare('SELECT status FROM physician_review_application WHERE id = ?').get('application').status, 'pending');
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_outbox').get().count, 1);
    assert.throws(() => database.prepare("UPDATE physician_review_application SET status = 'invented'").run(), /CHECK constraint/);
  } finally { database.close(); }
});

test('token binds application and reviewer, is hashed at rest, and survives restart retries', () => {
  const database = setup();
  try {
    const approval = service(database);
    const first = issue(approval);
    const retry = issue(service(database));
    assert.equal(first.token, retry.token);
    assert.equal(first.issueId, retry.issueId);
    assert.equal(first.token.length, 43);
    assert.notEqual(database.prepare('SELECT token_digest FROM physician_review_approval_token').get().token_digest, first.token);
    assert.equal(approval.inspect(first.token, { ...reviewer, userId: 'other' }).reason, 'approval_unavailable');
    assert.deepEqual(approval.inspect(first.token, reviewer).application, {
      id: 'application', requestedAt: '2026-01-01T00:00:00.000Z', status: 'pending',
      email: 'patient@example.invalid', name: 'Patient Example',
    });
    assert.equal(database.prepare('SELECT status FROM physician_review_application').get().status, 'pending');
  } finally { database.close(); }
});

test('expiry and invalid token fail closed; approval consumes, updates, and audits atomically', () => {
  const database = setup();
  let current = Date.parse('2026-01-02T00:00:00.000Z');
  try {
    const approval = service(database, { now: () => current });
    const issued = issue(approval);
    assert.equal(approval.approve(`${issued.token.slice(0, -1)}x`, reviewer).reason, 'approval_unavailable');
    current += 1_000;
    assert.equal(approval.inspect(issued.token, reviewer).reason, 'approval_unavailable');
    const fresh = issue(approval);
    assert.notEqual(fresh.issueId, issued.issueId);
    assert.deepEqual(approval.approve(fresh.token, reviewer), {
      ok: true, application: { id: 'application', status: 'approved' },
    });
    assert.equal(database.prepare('SELECT status FROM physician_review_application').get().status, 'approved');
    assert.equal(database.prepare('SELECT consumed_at FROM physician_review_approval_token WHERE id = ?').get(fresh.issueId).consumed_at, new Date(current).toISOString());
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
    const audit = database.prepare('SELECT reviewer_user_id, target_user_id, operator, action, result, evidence_reference FROM physician_review_approval_audit').get();
    assert.deepEqual(audit, {
      reviewer_user_id: 'reviewer', target_user_id: 'patient', operator: 'reviewer',
      action: 'approve', result: 'approved', evidence_reference: fresh.issueId,
    });
    assert.throws(() => database.prepare('DELETE FROM physician_review_approval_audit').run(), /immutable/);
    assert.equal(approval.approve(fresh.token, reviewer).reason, 'approval_unavailable');
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
  } finally { database.close(); }
});

test('missing authorization, fresh MFA, or active session guard blocks without consuming token', async () => {
  const database = setup();
  let authorization = true;
  let mfa = false;
  try {
    const approval = service(database, { guards: {
      authorizeReviewer: () => authorization,
      hasCurrentSessionMfa: () => mfa,
    } });
    const issued = issue(approval);
    assert.equal(approval.approve(issued.token, reviewer).reason, 'reviewer_or_fresh_mfa_required');
    authorization = false;
    mfa = true;
    assert.equal(approval.approve(issued.token, reviewer).reason, 'reviewer_or_fresh_mfa_required');
    authorization = true;
    const outcomes = await Promise.all([
      Promise.resolve().then(() => approval.approve(issued.token, reviewer)),
      Promise.resolve().then(() => approval.approve(issued.token, reviewer)),
    ]);
    assert.equal(outcomes.filter(value => value.ok).length, 1);
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 1);
  } finally { database.close(); }
});

test('a reviewer cannot issue, inspect, or approve their own application', () => {
  const database = setup();
  const selfToken = 'A'.repeat(43);
  try {
    database.prepare(`INSERT INTO physician_review_application (id, account_user_id, status, requested_at)
      VALUES ('self-application', 'reviewer', 'pending', '2026-01-01T00:00:00.000Z')`).run();
    database.prepare(`INSERT INTO physician_review_approval_token
      (id, application_id, reviewer_user_id, token_digest, created_at, expires_at, recipient_email)
      VALUES ('self-token-row', 'self-application', 'reviewer', ?, '2026-01-01T00:00:00.000Z',
        '2099-01-01T00:00:00.000Z', 'reviewer@example.invalid')`)
      .run(createHash('sha256').update(selfToken).digest('hex'));
    const approval = service(database);
    assert.equal(approval.issueForApplication('self-application', 'reviewer', 'reviewer@example.invalid'), null);
    assert.equal(approval.inspect(selfToken, reviewer).reason, 'approval_unavailable');
    assert.equal(approval.approve(selfToken, reviewer).reason, 'approval_unavailable');
    assert.equal(database.prepare("SELECT status FROM physician_review_application WHERE id = 'self-application'").get().status, 'pending');
    assert.equal(database.prepare('SELECT count(*) AS count FROM physician_review_approval_audit').get().count, 0);
  } finally { database.close(); }
});
