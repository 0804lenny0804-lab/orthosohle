export function migratePatientProfiles(database) {
  return database.transaction(() => migratePatientProfilesInTransaction(database)).immediate();
}

function migratePatientProfilesInTransaction(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS patient_profile (
      id TEXT PRIMARY KEY NOT NULL,
      account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL
    );
  `);
  // Additive, repeatable migration: older profile rows keep their identity and
  // creation time while receiving an empty local form at version zero.
  const columns = new Set(database.prepare('PRAGMA table_info(patient_profile)').all().map(column => column.name));
  if (!columns.has('injury')) database.exec('ALTER TABLE patient_profile ADD COLUMN injury TEXT');
  if (!columns.has('weight_kg')) database.exec('ALTER TABLE patient_profile ADD COLUMN weight_kg REAL');
  if (!columns.has('version')) database.exec('ALTER TABLE patient_profile ADD COLUMN version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)');
  if (!columns.has('updated_at')) database.exec('ALTER TABLE patient_profile ADD COLUMN updated_at TEXT');
  const auditExists = Boolean(database.prepare(`SELECT 1 FROM sqlite_master
    WHERE type = 'table' AND name = 'patient_profile_audit'`).get());
  if (!auditExists) {
    database.exec(`CREATE TABLE patient_profile_audit (
      id TEXT PRIMARY KEY NOT NULL,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
      action TEXT NOT NULL CHECK (action = 'updated'),
      occurred_at TEXT NOT NULL,
      profile_version INTEGER NOT NULL CHECK (profile_version > 0)
    )`);
  } else {
    const auditColumns = new Set(database.prepare('PRAGMA table_info(patient_profile_audit)').all().map(column => column.name));
    const duplicateVersions = auditColumns.has('profile_version') && database.prepare(`
      SELECT 1 FROM patient_profile_audit
      GROUP BY patient_profile_id, profile_version HAVING COUNT(*) > 1 LIMIT 1
    `).get();
    if (!auditColumns.has('profile_version') || duplicateVersions) {
      // Rebuild rather than UPDATE in place: partial legacy migrations may have
      // assigned the same default version to several immutable events. Ordering
      // by event time and id repairs those duplicates deterministically while
      // preserving the event fields and protecting the whole migration in one TX.
      database.exec(`
        DROP TRIGGER IF EXISTS patient_profile_audit_no_update;
        DROP TRIGGER IF EXISTS patient_profile_audit_no_delete;
        CREATE TABLE patient_profile_audit_next (
          id TEXT PRIMARY KEY NOT NULL,
          patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
          actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
          action TEXT NOT NULL CHECK (action = 'updated'),
          occurred_at TEXT NOT NULL,
          profile_version INTEGER NOT NULL CHECK (profile_version > 0)
        );
        INSERT INTO patient_profile_audit_next
          (id, patient_profile_id, actor_user_id, action, occurred_at, profile_version)
          SELECT id, patient_profile_id, actor_user_id, action, occurred_at,
            ROW_NUMBER() OVER (PARTITION BY patient_profile_id ORDER BY occurred_at, id)
          FROM patient_profile_audit;
        DROP TABLE patient_profile_audit;
        ALTER TABLE patient_profile_audit_next RENAME TO patient_profile_audit;
      `);
    }
  }
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS patient_profile_audit_no_update BEFORE UPDATE ON patient_profile_audit
      BEGIN SELECT RAISE(ABORT, 'patient profile audit is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS patient_profile_audit_no_delete BEFORE DELETE ON patient_profile_audit
      BEGIN SELECT RAISE(ABORT, 'patient profile audit is immutable'); END;
  `);
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS patient_profile_audit_version
    ON patient_profile_audit(patient_profile_id, profile_version)`);
  database.exec(`
    CREATE TABLE IF NOT EXISTS measurement_session (
      id TEXT PRIMARY KEY NOT NULL,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      source TEXT NOT NULL CHECK (source IN ('ble', 'simulation')),
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      CHECK (started_at < ended_at)
    );
    CREATE INDEX IF NOT EXISTS measurement_session_profile_started
      ON measurement_session(patient_profile_id, started_at, id);
    CREATE TABLE IF NOT EXISTS measurement_interval (
      session_id TEXT NOT NULL REFERENCES measurement_session(id) ON DELETE CASCADE,
      received_at TEXT NOT NULL,
      sample_count INTEGER NOT NULL CHECK (sample_count > 0 AND sample_count <= 100000),
      average REAL NOT NULL CHECK (average >= 0 AND average <= 1000000),
      maximum REAL NOT NULL CHECK (maximum >= average AND maximum <= 1000000),
      PRIMARY KEY (session_id, received_at)
    ) WITHOUT ROWID;
  `);
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS measurement_interval_session_bounds
    BEFORE INSERT ON measurement_interval
    WHEN NEW.received_at < (SELECT strftime('%Y-%m-%dT%H:%M:%fZ', started_at, '-1 second') FROM measurement_session WHERE id = NEW.session_id)
      OR NEW.received_at > (SELECT strftime('%Y-%m-%dT%H:%M:%fZ', ended_at) FROM measurement_session WHERE id = NEW.session_id)
    BEGIN
      SELECT RAISE(ABORT, 'measurement interval outside session bounds');
    END;
  `);
}
