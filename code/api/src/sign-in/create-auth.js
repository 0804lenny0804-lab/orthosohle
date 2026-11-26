import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';
import { localVerification } from './email-verification.js';
import { localRecovery } from './password-recovery.js';

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
    hooks: {
      before: createAuthMiddleware(async ctx => {
        await recovery.before(ctx);
        await verification.before(ctx);
      }),
      after: createAuthMiddleware(async ctx => {
        if (!forMigration && ['/two-factor/verify-totp', '/two-factor/verify-backup-code'].includes(ctx.path)
            && ctx.context.newSession?.session && ctx.context.newSession?.user
            && await ctx.getSignedCookie(ctx.context.createAuthCookie('two_factor').name, ctx.context.secret)) {
          const { session, user } = ctx.context.newSession;
          const now = Date.now();
          // Only a successful second-factor login creates a new session. Enrollment
          // and verification inside an existing session do not grant this proof.
          database.prepare(`
            INSERT INTO physician_session_proof(session_id, user_id, verified_at)
            SELECT s.id, u.id, ? FROM session s
              JOIN user u ON u.id = s.userId AND u.twoFactorEnabled = 1
              JOIN twoFactor tf ON tf.userId = u.id AND tf.verified = 1
            WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ?
            ON CONFLICT(session_id) DO UPDATE SET user_id = excluded.user_id, verified_at = excluded.verified_at
          `).run(now, session.id, user.id, session.token, new Date(now).toISOString());
        }
        if (ctx.path !== '/sign-in/email' || !ctx.context.newSession
            || ctx.context.newSession.user.twoFactorEnabled === true) return;
        const userId = ctx.context.newSession.user.id;
        const user = database.prepare('SELECT twoFactorEnabled FROM user WHERE id = ?').get(userId);
        if (user?.twoFactorEnabled === 1) {
          // A sign-in may have read the old user state in another API process. Never return that password-only session.
          database.prepare('DELETE FROM session WHERE token = ?').run(ctx.context.newSession.session.token);
          ctx.context.newSession = null;
          ctx.context.responseHeaders?.delete('set-cookie');
          return new Response(JSON.stringify({
            code: 'TWO_FACTOR_REQUIRED',
            message: 'Two-factor verification is required. Please sign in again.',
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        }
      }),
    },
    account: { accountLinking: { enabled: true, disableImplicitLinking: true } },
    session: { cookieCache: { enabled: false } },
    plugins: [twoFactor({ issuer: 'OrthoSohle Local' })],
    rateLimit: { enabled: true, storage: 'database' },
    advanced: { useSecureCookies: false, database: { validateSchema: !forMigration } },
    telemetry: { enabled: false },
  });
  return { auth, database, close: () => database.close() };
}
