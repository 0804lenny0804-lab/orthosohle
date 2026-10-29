import { chmodSync, mkdirSync } from "node:fs";
import { createLocalMail } from "./auth/local-mail.js";
import Database from "better-sqlite3";
import { createApp } from "./app.js";
import { createLocalAuth } from "./auth/create-auth.js";

// Explizite lokale Freigabe, damit unverifizierte Testkonten nicht produktiv starten.
if (
  process.env.AUTH_DEV_MODE !== "true" ||
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    "Nur lokaler Auth-Testbetrieb unterstützt: AUTH_DEV_MODE=true setzen.",
  );
}
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Ungültiger PORT");
}
process.umask(0o077);
mkdirSync("data/local", { recursive: true, mode: 0o700 });
const database = new Database("data/local/auth.db");
chmodSync("data/local/auth.db", 0o600);
const auth = await createLocalAuth({
  database,
  sendMail: createLocalMail("data/local/mail"),
  secret: process.env.AUTH_SECRET,
  baseURL: "http://127.0.0.1:5173",
  trustedOrigins: ["http://127.0.0.1:5173"],
});
const server = createApp({
  demo: process.env.DEMO_MODE === "true",
  auth,
}).listen(port, "127.0.0.1", () =>
  console.log(`Lokale OrthoSohle-API: http://127.0.0.1:${port}`),
);
function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
