import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from './auth.js';
import { readConfig } from './config.js';

const runtime = createAuth(readConfig(), { forMigration: true });
try {
  const { runMigrations } = await getMigrations(runtime.auth.options);
  await runMigrations();
  console.log('Local authentication schema migrated.');
} finally {
  runtime.close();
}
