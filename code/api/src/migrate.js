import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from './auth.js';
import { readConfig } from './config.js';
import { migratePatientProfiles } from './patient-profile-migration.js';
import { migratePhysicianReview } from './physician-review-migration.js';
import { migrateTwoFactorSessions } from './two-factor-session-migration.js';

const runtime = createAuth(readConfig(), { forMigration: true });
try {
  const { runMigrations } = await getMigrations(runtime.auth.options);
  await runMigrations();
  migratePatientProfiles(runtime.database);
  migratePhysicianReview(runtime.database);
  migrateTwoFactorSessions(runtime.database);
  console.log('Local authentication, TOTP, patient profile, and physician review schemas migrated.');
} finally {
  runtime.close();
}
