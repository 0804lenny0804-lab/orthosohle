import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import Database from "better-sqlite3";
import { createLocalAuth } from "./create-auth.js";
import { createApp } from "../app.js";

test("Testkonto: Anmeldung, geschützte API, Origin-Prüfung und Sessionwiderruf", async (t) => {
  const database = new Database(":memory:");
  const origin = "http://127.0.0.1:5173";
  const auth = await createLocalAuth({
    database,
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
  assert.equal((await post("/api/auth/sign-out", {}, cookie)).status, 200);
  assert.equal(
    (await fetch(base + "/api/plan", { headers: { Cookie: cookie } })).status,
    401,
  );
  assert.equal(
    (
      await post("/api/auth/sign-in/email", {
        ...credentials,
        password: "wrong-password-123",
      })
    ).status,
    401,
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
