export function migrateReviewerBootstrap(database) {
  database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS physician_reviewer_grant (
        user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
        granted_at TEXT NOT NULL,
        revoked_at TEXT,
        CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
      );
      CREATE TABLE IF NOT EXISTS physician_reviewer_audit (
        id TEXT PRIMARY KEY NOT NULL,
        operator TEXT NOT NULL,
        reviewer_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
        action TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS physician_reviewer_audit_subject_idx
        ON physician_reviewer_audit(reviewer_user_id, occurred_at);
      CREATE TRIGGER IF NOT EXISTS physician_reviewer_audit_no_update
        BEFORE UPDATE ON physician_reviewer_audit BEGIN SELECT RAISE(ABORT, 'reviewer audit is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS physician_reviewer_audit_no_delete
        BEFORE DELETE ON physician_reviewer_audit BEGIN SELECT RAISE(ABORT, 'reviewer audit is immutable'); END;
    `);
  })();
}
