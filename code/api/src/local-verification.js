import { createHash } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { writeLocalMail } from './local-mail.js';

const fingerprint = token => createHash('sha256').update(token).digest('hex');

export function localVerification(config, getContext) {
  const expiresIn = config.verificationExpiresIn ?? 3600;
  const callbackURL = `${config.webOrigin}/#account`;
  return {
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn,
      async sendVerificationEmail({ user, token }) {
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
        writeLocalMail(config, {
          to: user.email,
          subject: 'Lokales Testkonto: E-Mail bestätigen',
          verificationURL: url.href,
        });
      },
    },
    async before(ctx) {
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
    },
  };
}
