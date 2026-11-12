import { randomUUID } from 'node:crypto';

export function createPatientProfileRepository(database) {
  const insertProfile = database.prepare(`
    INSERT INTO patient_profile (id, account_user_id, created_at)
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(account_user_id) DO NOTHING
  `);
  const findByOwner = database.prepare(`
    SELECT id, created_at AS createdAt
    FROM patient_profile
    WHERE account_user_id = ?
  `);

  return {
    findForAccount(accountUserId) {
      return findByOwner.get(accountUserId) ?? null;
    },
    createForAccount(accountUserId) {
      insertProfile.run(randomUUID(), accountUserId);
      return findByOwner.get(accountUserId);
    },
  };
}
