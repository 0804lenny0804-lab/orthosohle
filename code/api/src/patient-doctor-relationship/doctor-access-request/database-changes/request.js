export function migratePhysicianReview(database) {
  database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS physician_review_application (
        id TEXT PRIMARY KEY NOT NULL,
        account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (status = 'pending'),
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
    `);
  })();
}
