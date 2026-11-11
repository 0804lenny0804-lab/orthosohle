import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { migratePatientProfiles } from '../src/patient-profile-migration.js';
import { migratePhysicianReview } from '../src/physician-review-migration.js';
import { migrateTwoFactorSessions } from '../src/two-factor-session-migration.js';
import { migrateReviewerBootstrap } from '../src/reviewer-bootstrap-migration.js';
import { migrateTotpStepUp } from '../src/totp-step-up-migration.js';
import { migratePhysicianApproval } from '../src/physician-approval-migration.js';
import { migratePatientRelations } from '../src/patient-relations.js';

export const account = {
  name: 'Synthetic Test',
  email: 'synthetic@example.invalid',
  password: 'Synthetic-test-password-42!',
};

export async function fixture(t, {
  verificationExpiresIn = 3600,
  resetExpiresIn = 3600,
  physicianReviewNotifyEmail = 'lo030@hdm-stuttgart.de',
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'orthosohle-auth-'));
  const databasePath = join(directory, 'auth.sqlite');
  const secret = randomBytes(48).toString('base64url');
  let runtime;
  let server;
  let baseURL;

  async function stop() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    runtime?.close();
    runtime = undefined;
  }

  async function start(migrate = false) {
    server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseURL = `http://127.0.0.1:${server.address().port}`;
    const config = readConfig({
      LOCAL_AUTH_ENABLED: 'true',
      BETTER_AUTH_SECRET: secret,
      AUTH_BASE_URL: baseURL,
      AUTH_DATABASE_PATH: databasePath,
      ...(physicianReviewNotifyEmail ? {
        PHYSICIAN_REVIEW_NOTIFY_EMAIL: physicianReviewNotifyEmail,
      } : {}),
    });
    config.verificationExpiresIn = verificationExpiresIn;
    config.resetExpiresIn = resetExpiresIn;
    runtime = createAuth(config, { forMigration: migrate });
    if (migrate) {
      const { runMigrations } = await getMigrations(runtime.auth.options);
      await runMigrations();
      migratePatientProfiles(runtime.database);
      migratePhysicianReview(runtime.database);
      migrateTwoFactorSessions(runtime.database);
      migrateReviewerBootstrap(runtime.database);
      migrateTotpStepUp(runtime.database);
      migratePhysicianApproval(runtime.database);
      migratePatientRelations(runtime.database);
      runtime.close();
      runtime = createAuth(config);
    }
    server.on('request', createApp(runtime.auth, { ...config, database: runtime.database }));
  }

  t.after(async () => {
    await stop();
    await rm(directory, { recursive: true, force: true });
  });
  await start(true);
  return {
    async restart() {
      await stop();
      await start();
    },
    async request(path, { cookie, body, rawBody, origin = baseURL, method, contentType, omitOrigin = false } = {}) {
      const requestMethod = method || (body !== undefined || rawBody !== undefined ? 'POST' : 'GET');
      return fetch(`${baseURL}${path}`, {
        redirect: 'manual',
        method: requestMethod,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(requestMethod !== 'GET' && !omitOrigin ? { Origin: origin } : {}),
          ...(contentType ? { 'Content-Type': contentType }
            : body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) }
          : rawBody !== undefined ? { body: rawBody } : {}),
      });
    },
    async mails() {
      const outbox = `${databasePath}.mail-outbox`;
      const names = await readdir(outbox);
      return Promise.all(names.map(async name => ({
        path: join(outbox, name),
        mail: JSON.parse(await readFile(join(outbox, name), 'utf8')),
      })));
    },
    get auth() { return runtime.auth; },
    get database() { return runtime.database; },
    get databasePath() { return databasePath; },
  };
}

export function cookies(response) {
  const value = response.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  assert.ok(value.includes('session_token='));
  return value;
}

export async function signUp(f, verify = true, user = account) {
  const response = await f.request('/api/auth/sign-up/email', { body: user });
  assert.equal(response.status, 200);
  const id = (await response.json()).user.id;
  if (verify) {
    const message = (await f.mails()).find(entry => entry.mail.to === user.email);
    assert.equal((await f.request(verificationPath(message.mail))).status, 200);
  }
  return id;
}

export function signIn(f, password = account.password, user = account) {
  return f.request('/api/auth/sign-in/email', { body: { email: user.email, password } });
}

function verificationPath(mail) {
  const url = new URL(mail.verificationURL);
  url.searchParams.delete('callbackURL');
  return `${url.pathname}${url.search}`;
}
