export function migrateTotpStepUp(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS totp_step_up_attempt (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      window_started_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL CHECK (attempts >= 0),
      generation INTEGER NOT NULL DEFAULT 0 CHECK (generation >= 0),
      verified_at INTEGER,
      expires_at INTEGER,
      CHECK ((verified_at IS NULL AND expires_at IS NULL)
        OR (verified_at IS NOT NULL AND expires_at IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS totp_step_up_session_idx ON totp_step_up_attempt(session_id);
    CREATE TRIGGER IF NOT EXISTS clear_totp_step_up_on_factor_disable
      AFTER UPDATE OF twoFactorEnabled ON user
      WHEN NEW.twoFactorEnabled = 0
      BEGIN DELETE FROM totp_step_up_attempt WHERE user_id = NEW.id; END;
    CREATE TRIGGER IF NOT EXISTS clear_totp_step_up_on_factor_change
      AFTER UPDATE OF secret, verified ON twoFactor
      BEGIN DELETE FROM totp_step_up_attempt WHERE user_id = NEW.userId; END;
    CREATE TRIGGER IF NOT EXISTS clear_totp_step_up_on_factor_delete
      AFTER DELETE ON twoFactor
      BEGIN DELETE FROM totp_step_up_attempt WHERE user_id = OLD.userId; END;
  `);
}
