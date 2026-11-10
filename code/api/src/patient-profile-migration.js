export function migratePatientProfiles(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS patient_profile (
      id TEXT PRIMARY KEY NOT NULL,
      account_user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL
    );
  `);
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
