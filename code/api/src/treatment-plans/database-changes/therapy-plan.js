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
