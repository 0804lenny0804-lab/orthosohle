import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import Database from "better-sqlite3";
import { createLocalAuth } from "./create-auth.js";
import { createApp } from "../app.js";

test("Testkonto: Anmeldung, geschützte API, Origin-Prüfung und Sessionwiderruf", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const database = new Database(":memory:");
  const origin = "http://127.0.0.1:5173";
  const messages = [];
  const auth = await createLocalAuth({
    database,
    sendMail: async (message) => messages.push(message),
    secret: "test-only-secret-with-at-least-32-characters",
    baseURL: origin,
    trustedOrigins: [origin],
  });
  const server = createApp({ auth, demo: true }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = "", requestOrigin = origin) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: requestOrigin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(base + "/api/plan")).status, 401);
  const credentials = {
    email: "patient@example.test",
    password: "synthetic-password-123",
    name: "Testperson",
  };
  const signup = await post("/api/auth/sign-up/email", credentials);
  assert.equal(signup.status, 200, await signup.clone().text());
  assert.equal(
    (await post("/api/auth/sign-in/email", credentials)).status,
    403,
  );
  const verification = messages.find(
    (message) => message.kind === "verify-email",
  );
  assert.ok(verification);
  const verificationURL = new URL(verification.url);
  const verified = await fetch(
    base + verificationURL.pathname + verificationURL.search,
    { redirect: "manual" },
  );
  assert.equal(verified.status, 302);
  const login = await post("/api/auth/sign-in/email", credentials);
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("session_token"));
  assert.match(login.headers.get("set-cookie"), /httponly/i);
  assert.match(login.headers.get("set-cookie"), /samesite=lax/i);
  assert.equal(
    (await fetch(base + "/api/plan", { headers: { Cookie: cookie } })).status,
    200,
  );
  assert.equal(
    (await post("/api/auth/sign-out", {}, cookie, "https://foreign.example"))
      .status,
    403,
  );
  await post("/api/auth/request-password-reset", {
    email: credentials.email,
    redirectTo: origin + "/?reset=1",
  });
  const reset = messages.find((message) => message.kind === "reset-password");
  assert.ok(reset);
  const resetURL = new URL(reset.url);
  const resetRedirect = await fetch(
    base + resetURL.pathname + resetURL.search,
    { redirect: "manual" },
  );
  assert.equal(resetRedirect.status, 302);
  const token = new URL(resetRedirect.headers.get("location")).searchParams.get(
    "token",
  );
  const resetBody = { token, newPassword: "new-synthetic-password-456" };
  assert.equal((await post("/api/auth/reset-password", resetBody)).status, 200);
  assert.notEqual(
    (await post("/api/auth/reset-password", resetBody)).status,
    200,
  );
  assert.equal(
    (await post("/api/auth/sign-in/email", credentials)).status,
    401,
  );
  t.mock.timers.tick(61_000);
  const newLogin = await post("/api/auth/sign-in/email", {
    ...credentials,
    password: resetBody.newPassword,
  });
  assert.equal(newLogin.status, 200);
  const newCookie = newLogin.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.equal((await post("/api/auth/sign-out", {}, newCookie)).status, 200);
  assert.equal(
    (await fetch(base + "/api/plan", { headers: { Cookie: cookie } })).status,
    401,
  );
  // Ein neuer Token wird nach Ablauf abgewiesen, ohne Passwortänderung.
  t.mock.timers.tick(61_000);
  messages.length = 0;
  assert.equal(
    (
      await post("/api/auth/request-password-reset", {
        email: credentials.email,
        redirectTo: origin + "/?reset=1",
      })
    ).status,
    200,
  );
  const expiringURL = new URL(messages[0].url);
  const redirect = await fetch(
    base + expiringURL.pathname + expiringURL.search,
    { redirect: "manual" },
  );
  const expiredToken = new URL(
    redirect.headers.get("location"),
  ).searchParams.get("token");
  t.mock.timers.tick(901_000);
  assert.equal(
    (
      await post("/api/auth/reset-password", {
        token: expiredToken,
        newPassword: "never-applied-password-123",
      })
    ).status,
    400,
  );
});

test("Fehlende Auth-Konfiguration sperrt den Planendpunkt", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  assert.equal(
    (await fetch(`http://127.0.0.1:${server.address().port}/api/plan`)).status,
    503,
  );
});
