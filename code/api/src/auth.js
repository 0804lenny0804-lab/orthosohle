import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';

export function createAuth(config, { forMigration = false } = {}) {
  mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });
  const database = new Database(config.databasePath);
  chmodSync(config.databasePath, 0o600);
  database.pragma('foreign_keys = ON');
  const auth = betterAuth({
    appName: 'OrthoSohle Local',
    baseURL: config.baseURL,
    secret: config.secret,
    database,
    trustedOrigins: [config.baseURL, config.webOrigin],
    // shortcut: loopback identity probe only; mail verification is a later step.
    emailAndPassword: { enabled: true, autoSignIn: false },
    account: { accountLinking: { enabled: true, disableImplicitLinking: true } },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database' },
    advanced: { useSecureCookies: false, database: { validateSchema: !forMigration } },
    telemetry: { enabled: false },
  });
  return { auth, close: () => database.close() };
}
