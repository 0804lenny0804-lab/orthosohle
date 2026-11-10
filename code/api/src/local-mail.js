import { randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';

export function writeLocalMail(config, message) {
  const outbox = `${config.databasePath}.mail-outbox`;
  mkdirSync(outbox, { recursive: true, mode: 0o700 });
  const entry = lstatSync(outbox);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error('Local mail outbox must be a private directory.');
  }
  chmodSync(outbox, 0o700);
  writeFileSync(`${outbox}/${randomUUID()}.json`, JSON.stringify({
    mode: 'LOCAL SYNTHETIC TEST MAIL — NOT SENT', ...message,
  }, null, 2), { mode: 0o600, flag: 'wx' });
}
