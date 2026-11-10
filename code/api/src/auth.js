import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { localVerification } from './local-verification.js';
import { localRecovery } from './local-recovery.js';

export function createAuth(config, { forMigration = false } = {}) {
  mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });
  const database = new Database(config.databasePath);
  chmodSync(config.databasePath, 0o600);
  database.pragma('foreign_keys = ON');
  const verification = localVerification(config, () => auth.$context);
  const recovery = localRecovery(config);
  const auth = betterAuth({
    appName: 'OrthoSohle Local',
    baseURL: config.baseURL,
    secret: config.secret,
    database,
    trustedOrigins: [config.baseURL, config.webOrigin],
    emailVerification: verification.emailVerification,
    emailAndPassword: { ...recovery.emailAndPassword, enabled: true, autoSignIn: false, requireEmailVerification: true },
    verification: { storeIdentifier: 'hashed' },
    hooks: { before: createAuthMiddleware(async ctx => {
      await recovery.before(ctx);
      await verification.before(ctx);
    }) },
    account: { accountLinking: { enabled: true, disableImplicitLinking: true } },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database' },
    advanced: { useSecureCookies: false, database: { validateSchema: !forMigration } },
    telemetry: { enabled: false },
  });
  return { auth, close: () => database.close() };
}
