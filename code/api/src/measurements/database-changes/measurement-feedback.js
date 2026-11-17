/** Repeatable migration for one mutable patient feedback value per BLE session. */
export function migrateMeasurementFeedback(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS measurement_feedback (
      measurement_session_id TEXT PRIMARY KEY NOT NULL REFERENCES measurement_session(id) ON DELETE RESTRICT,
      patient_profile_id TEXT NOT NULL REFERENCES patient_profile(id) ON DELETE RESTRICT,
      rating TEXT NOT NULL CHECK (rating IN ('good', 'medium', 'bad')),
      comment TEXT,
      version INTEGER NOT NULL CHECK (version > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (comment IS NULL OR length(comment) <= 500)
    );
    CREATE INDEX IF NOT EXISTS measurement_feedback_patient
      ON measurement_feedback(patient_profile_id, updated_at DESC);
  `);
}
