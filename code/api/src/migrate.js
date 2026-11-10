import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from './auth.js';
import { readConfig } from './config.js';
import { migratePatientProfiles } from './patient-profile-migration.js';

const runtime = createAuth(readConfig(), { forMigration: true });
try {
  const { runMigrations } = await getMigrations(runtime.auth.options);
  await runMigrations();
  migratePatientProfiles(runtime.database);
  console.log('Local authentication and patient profile schemas migrated.');
} finally {
  runtime.close();
}
