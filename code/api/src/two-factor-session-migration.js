export function migrateTwoFactorSessions(database) {
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS revoke_sessions_when_two_factor_enabled
    AFTER UPDATE OF twoFactorEnabled ON user
    WHEN OLD.twoFactorEnabled = 0 AND NEW.twoFactorEnabled = 1
    BEGIN
      DELETE FROM session WHERE userId = NEW.id;
    END;
  `);
}
