import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

// Lokaler Machbarkeitsnachweis: keine Arztrollen oder Gesundheitsdaten.
// E-Mail-Verifikation/MFA und ein versionierter Migrationsprozess folgen vor Pilotbetrieb.
export async function createLocalAuth({
  database,
  secret,
  baseURL,
  trustedOrigins,
}) {
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET muss mindestens 32 Zeichen enthalten.");
  }
  const options = {
    database,
    secret,
    baseURL,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
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
