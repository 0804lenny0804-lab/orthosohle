import { APIError } from 'better-auth/api';
import { writeLocalMail } from './local-mail.js';

export function localRecovery(config) {
  const callbackURL = `${config.webOrigin}/#account`;
  return {
    emailAndPassword: {
      resetPasswordTokenExpiresIn: config.resetExpiresIn ?? 3600,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, token }) {
        const url = new URL(config.webOrigin);
        // Fragments never reach the HTTP server or its access log.
        url.hash = `account?reset=${encodeURIComponent(token)}`;
        writeLocalMail(config, {
          to: user.email,
          subject: 'Lokales Testkonto: Passwort zurücksetzen',
          resetURL: url.href,
        });
      },
    },
    async before(ctx) {
      for (const value of [ctx.body?.callbackURL, ctx.body?.redirectTo]) {
        if (value !== undefined && value !== callbackURL) {
          throw new APIError('FORBIDDEN', { code: 'INVALID_CALLBACK_URL', message: 'Invalid account callback.' });
        }
      }
      if (ctx.path.startsWith('/reset-password/') && ctx.query?.callbackURL !== callbackURL) {
        throw new APIError('FORBIDDEN', { code: 'INVALID_CALLBACK_URL', message: 'Invalid recovery callback.' });
      }
      if (ctx.path === '/sign-up/email' || ctx.path === '/update-user') {
        const name = ctx.body?.name;
        if (ctx.path === '/sign-up/email' || name !== undefined) {
          if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
            throw new APIError('BAD_REQUEST', { code: 'INVALID_NAME', message: 'Display name must contain 1 to 100 characters.' });
          }
          ctx.body.name = name.trim();
        }
      }
    },
  };
}
