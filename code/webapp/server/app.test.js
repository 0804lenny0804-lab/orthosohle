import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "./app.js";
import { loadPlan } from "../src/api.js";

for (const demo of [false, true]) {
  test(`API liefert expliziten Planzustand (demo=${demo}) und erlaubt keine Änderung`, async (t) => {
    const server = createApp({
      demo,
      auth: {
        handler: () => new Response(),
        api: { getSession: async () => ({ user: { id: "test-only" } }) },
      },
    }).listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}/api/plan`;
    const response = await fetch(url);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      source: demo ? "demo" : "unconfigured",
      plan: demo ? { version: 1, limitKg: 20 } : null,
      deviceApplied: false,
    });
    assert.equal((await fetch(url, { method: "POST" })).status, 404);
  });
}

test("Client verweigert fehlerhafte oder irreführende Planantworten", async (t) => {
  for (const data of [
    null,
    [],
    {},
    {
      source: "demo",
      plan: { version: 1, limitKg: { limit_value: 20 } },
      deviceApplied: false,
    },
    { source: "demo", plan: { version: 1, limitKg: -1 }, deviceApplied: false },
    { source: "demo", plan: null, deviceApplied: true },
    {
      source: "unconfigured",
      plan: { version: 1, limitKg: 20 },
      deviceApplied: false,
    },
  ]) {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(data)),
    );
    await assert.rejects(loadPlan, /ungültigen Plan/);
    t.mock.restoreAll();
  }
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 503 }),
  );
  await assert.rejects(loadPlan, /nicht geladen/);
});

test("Client akzeptiert fehlenden und numerischen Demo-Plan", async (t) => {
  for (const plan of [null, { version: 1, limitKg: 20 }]) {
    const data = { source: "demo", plan, deviceApplied: false };
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(data)),
    );
    assert.deepEqual(await loadPlan(), data);
    t.mock.restoreAll();
  }
});
