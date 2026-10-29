import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

// Lokaler Machbarkeitsnachweis: keine Arztrollen oder Gesundheitsdaten.
// Produktiver Mailtransport, MFA und versionierte Migrationen folgen vor Pilotbetrieb.
export async function createLocalAuth({
  database,
  secret,
  baseURL,
  trustedOrigins,
  sendMail,
}) {
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET muss mindestens 32 Zeichen enthalten.");
  }
  if (typeof sendMail !== "function")
    throw new Error("Mailtransport erforderlich");
  const options = {
    database,
    secret,
    baseURL,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 900,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        sendMail({ kind: "reset-password", to: user.email, url }),
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 1800,
      sendVerificationEmail: ({ user, url }) =>
        sendMail({ kind: "verify-email", to: user.email, url }),
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true },
  };
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
  return betterAuth(options);
}
