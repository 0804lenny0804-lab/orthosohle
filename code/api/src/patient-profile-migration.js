export function migratePatientProfiles(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS patient_profile (
      id TEXT PRIMARY KEY NOT NULL,
      account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL
    );
  `);
}
