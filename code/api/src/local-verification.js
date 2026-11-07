import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { APIError, createAuthMiddleware } from 'better-auth/api';

const fingerprint = token => createHash('sha256').update(token).digest('hex');

export function localVerification(config, getContext) {
  const expiresIn = config.verificationExpiresIn ?? 3600;
  const callbackURL = `${config.webOrigin}/#account`;
  const outbox = `${config.databasePath}.mail-outbox`;
  return {
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn,
      async sendVerificationEmail({ user, token }) {
        mkdirSync(outbox, { recursive: true, mode: 0o700 });
        if (!lstatSync(outbox).isDirectory() || lstatSync(outbox).isSymbolicLink()) {
          throw new Error('Local mail outbox must be a private directory.');
        }
        chmodSync(outbox, 0o700);
        const context = await getContext();
        // Only tokens issued by Better Auth receive this marker; never raw tokens in SQLite.
        await context.internalAdapter.createVerificationValue({
          identifier: `local-email-issued:${fingerprint(token)}`,
          value: user.id,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
        });
        const url = new URL('/api/auth/verify-email', config.baseURL);
        url.searchParams.set('token', token);
        url.searchParams.set('callbackURL', callbackURL);
        writeFileSync(`${outbox}/${randomUUID()}.json`, JSON.stringify({
          mode: 'LOCAL SYNTHETIC TEST MAIL — NOT SENT',
          to: user.email,
          subject: 'Lokales Testkonto: E-Mail bestätigen',
          verificationURL: url.href,
        }, null, 2), { mode: 0o600, flag: 'wx' });
      },
    },
    hooks: {
      before: createAuthMiddleware(async ctx => {
        if (ctx.path !== '/verify-email') return;
        const token = ctx.query?.token;
        if (ctx.query?.callbackURL && ctx.query.callbackURL !== callbackURL) {
          throw new APIError('FORBIDDEN', { code: 'INVALID_CALLBACK_URL', message: 'Invalid verification callback.' });
        }
        function reject() {
          if (ctx.query?.callbackURL === callbackURL) {
            throw ctx.redirect(`${config.webOrigin}/?verification=invalid#account`);
          }
          throw new APIError('UNAUTHORIZED', { code: 'INVALID_VERIFICATION', message: 'Verification is invalid, expired or already used.' });
        }
        if (typeof token !== 'string' || token.length > 8192) reject();
        const hash = fingerprint(token);
        // An exact, unexpired issuance marker must exist before any reservation.
        const issued = await ctx.context.internalAdapter.consumeVerificationValue(`local-email-issued:${hash}`);
        if (!issued) reject();
        // The library's atomic reservation also blocks a concurrent resend recreating an issued marker.
        const reserved = await ctx.context.internalAdapter.reserveVerificationValue({
          identifier: `local-email-used:${hash}`, value: issued.value, expiresAt: issued.expiresAt,
        });
        if (!reserved) reject();
        // Better Auth still validates its JWT and updates the user; no custom signing/decoding.
      }),
    },
  };
}
