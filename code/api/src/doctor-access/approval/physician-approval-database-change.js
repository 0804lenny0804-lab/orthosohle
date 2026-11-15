function hasTable(database, name) {
  return Boolean(database.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name));
}

function tableSql(database, name) {
  return database.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name)?.sql ?? '';
}

/** Evolves local approval state while preserving application, notification, token, and audit rows. */
export function migratePhysicianApproval(database) {
  database.transaction(() => {
    database.pragma('defer_foreign_keys = ON');
    const applicationSql = tableSql(database, 'physician_review_application');
    if (applicationSql && !applicationSql.includes("status IN ('pending', 'approved', 'revoked')")) {
      database.exec(`
        CREATE TABLE physician_review_application_next (
          id TEXT PRIMARY KEY NOT NULL,
          account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
          status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'revoked')),
          requested_at TEXT NOT NULL
        );
        INSERT INTO physician_review_application_next (id, account_user_id, status, requested_at)
          SELECT id, account_user_id, status, requested_at FROM physician_review_application;
      `);

      if (hasTable(database, 'physician_review_outbox')) {
        database.exec(`
          CREATE TABLE physician_review_outbox_next (
            id TEXT PRIMARY KEY NOT NULL,
            application_id TEXT NOT NULL UNIQUE REFERENCES physician_review_application_next(id) ON DELETE RESTRICT,
            recipient_email TEXT NOT NULL,
            applicant_email TEXT NOT NULL,
            created_at TEXT NOT NULL,
            materialized_at TEXT
          );
          INSERT INTO physician_review_outbox_next
            (id, application_id, recipient_email, applicant_email, created_at, materialized_at)
            SELECT id, application_id, recipient_email, applicant_email, created_at, materialized_at
            FROM physician_review_outbox;
          DROP TABLE physician_review_outbox;
        `);
      }

      if (hasTable(database, 'physician_review_approval_token')) {
        database.exec(`
          CREATE TABLE physician_review_approval_token_next (
            id TEXT PRIMARY KEY NOT NULL,
            application_id TEXT NOT NULL REFERENCES physician_review_application_next(id) ON DELETE RESTRICT,
            reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
            token_digest TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            consumed_at TEXT,
            recipient_email TEXT NOT NULL,
            materialized_at TEXT
          );
          INSERT INTO physician_review_approval_token_next
            (id, application_id, reviewer_user_id, token_digest, created_at, expires_at,
              consumed_at, recipient_email, materialized_at)
            SELECT id, application_id, reviewer_user_id, token_digest, created_at, expires_at,
              consumed_at, recipient_email, materialized_at FROM physician_review_approval_token;
          DROP TABLE physician_review_approval_token;
        `);
      }

      if (hasTable(database, 'physician_review_approval_audit')) {
        const oldAuditSql = tableSql(database, 'physician_review_approval_audit');
        const operatorSelect = oldAuditSql.includes('operator TEXT NOT NULL')
          ? 'operator' : "'system:prior-local-approval'";
        database.exec(`
          CREATE TABLE physician_review_approval_audit_next (
            id TEXT PRIMARY KEY NOT NULL,
            application_id TEXT NOT NULL REFERENCES physician_review_application_next(id) ON DELETE RESTRICT,
            reviewer_user_id TEXT REFERENCES user(id) ON DELETE RESTRICT,
            target_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
            operator TEXT NOT NULL,
            action TEXT NOT NULL CHECK (action IN ('approve', 'revoke')),
            result TEXT NOT NULL CHECK (result IN ('approved', 'revoked')),
            evidence_reference TEXT NOT NULL,
            occurred_at TEXT NOT NULL
          );
          INSERT INTO physician_review_approval_audit_next
            (id, application_id, reviewer_user_id, target_user_id, operator, action, result, evidence_reference, occurred_at)
            SELECT audit.id, audit.application_id, audit.reviewer_user_id,
              application.account_user_id, ${operatorSelect}, audit.action, audit.result,
              audit.evidence_reference, audit.occurred_at
            FROM physician_review_approval_audit AS audit
            JOIN physician_review_application AS application ON application.id = audit.application_id;
          DROP TABLE physician_review_approval_audit;
        `);
      }

      database.exec(`DROP TABLE physician_review_application; ALTER TABLE physician_review_application_next RENAME TO physician_review_application;`);
      if (hasTable(database, 'physician_review_outbox_next')) {
        database.exec('ALTER TABLE physician_review_outbox_next RENAME TO physician_review_outbox;');
      }
      if (hasTable(database, 'physician_review_approval_token_next')) {
        database.exec('ALTER TABLE physician_review_approval_token_next RENAME TO physician_review_approval_token;');
      }
      if (hasTable(database, 'physician_review_approval_audit_next')) {
        database.exec('ALTER TABLE physician_review_approval_audit_next RENAME TO physician_review_approval_audit;');
      }
    }

    database.exec(`
      CREATE TABLE IF NOT EXISTS physician_review_application (
        id TEXT PRIMARY KEY NOT NULL,
        account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'revoked')),
        requested_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS physician_review_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        application_id TEXT NOT NULL UNIQUE REFERENCES physician_review_application(id) ON DELETE RESTRICT,
        recipient_email TEXT NOT NULL,
        applicant_email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        materialized_at TEXT
      );
      CREATE TABLE IF NOT EXISTS physician_review_approval_token (
        id TEXT PRIMARY KEY NOT NULL,
        application_id TEXT NOT NULL REFERENCES physician_review_application(id) ON DELETE RESTRICT,
        reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
        token_digest TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        recipient_email TEXT NOT NULL,
        materialized_at TEXT
      );
      CREATE INDEX IF NOT EXISTS physician_review_approval_token_application
        ON physician_review_approval_token(application_id, reviewer_user_id, expires_at);
      CREATE TABLE IF NOT EXISTS physician_review_approval_audit (
        id TEXT PRIMARY KEY NOT NULL,
        application_id TEXT NOT NULL REFERENCES physician_review_application(id) ON DELETE RESTRICT,
        reviewer_user_id TEXT REFERENCES user(id) ON DELETE RESTRICT,
        target_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
        operator TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('approve', 'revoke')),
        result TEXT NOT NULL CHECK (result IN ('approved', 'revoked')),
        evidence_reference TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS physician_review_approval_audit_no_update
        BEFORE UPDATE ON physician_review_approval_audit
        BEGIN SELECT RAISE(ABORT, 'approval audit is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS physician_review_approval_audit_no_delete
        BEFORE DELETE ON physician_review_approval_audit
        BEGIN SELECT RAISE(ABORT, 'approval audit is immutable'); END;
    `);
  })();
}
