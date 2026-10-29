import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalMail } from "./local-mail.js";

test("Lokale Testnachrichten bleiben getrennt und nur für den Besitzer lesbar", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "orthosohle-mail-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "mail");
  const send = createLocalMail(directory);
  const message = {
    kind: "verify-email",
    to: "synthetic@example.test",
    url: "http://127.0.0.1/test",
  };
  await send(message);
  await send(message);
  const files = await readdir(directory);
  assert.equal(files.length, 2);
  const path = join(directory, files[0]);
  assert.equal(JSON.parse(await readFile(path, "utf8")).to, message.to);
  if (process.platform !== "win32") {
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  }
});
