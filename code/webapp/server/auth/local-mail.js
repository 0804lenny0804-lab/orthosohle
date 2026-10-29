import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Nur lokaler Testtransport: Links sind Zugangsdaten und gehören weder in Logs
// noch in eine öffentliche API. Das Verzeichnis liegt unter ignoriertem data/local.
export function createLocalMail(directory) {
  return async function sendMail(message) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(directory, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(
        { ...message, createdAt: new Date().toISOString() },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
  };
}
