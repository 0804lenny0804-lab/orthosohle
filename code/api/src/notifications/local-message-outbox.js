import { randomUUID } from 'node:crypto';
import {
  chmodSync, closeSync, fsyncSync, linkSync, lstatSync, mkdirSync,
  openSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';

export function writeLocalMail(config, message, { idempotencyKey, acceptExisting } = {}) {
  const outbox = `${config.databasePath}.mail-outbox`;
  mkdirSync(outbox, { recursive: true, mode: 0o700 });
  const entry = lstatSync(outbox);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error('Local mail outbox must be a private directory.');
  }
  chmodSync(outbox, 0o700);
  if (idempotencyKey !== undefined && !/^[a-z0-9-]{1,100}$/.test(idempotencyKey)) {
    throw new Error('Local mail idempotency key is invalid.');
  }
  const filename = idempotencyKey === undefined ? `${randomUUID()}.json` : `${idempotencyKey}.json`;
  const path = `${outbox}/${filename}`;
  const contents = JSON.stringify({
    mode: 'LOCAL SYNTHETIC TEST MAIL — NOT SENT', ...message,
  }, null, 2);
  const temporaryPath = `${outbox}/.tmp-${idempotencyKey ?? 'message'}-${randomUUID()}`;
  let descriptor;
  let ownsTemporaryFile = false;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    ownsTemporaryFile = true;
    writeFileSync(descriptor, contents, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try {
      // A same-directory hard link publishes the complete file atomically without replacement.
      linkSync(temporaryPath, path);
      const directoryDescriptor = openSync(outbox, 'r');
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } catch (error) {
      if (error?.code !== 'EEXIST' || idempotencyKey === undefined) throw error;
      const existing = lstatSync(path);
      const existingContents = existing.isFile() && !existing.isSymbolicLink()
        ? readFileSync(path, 'utf8') : null;
      if (existingContents !== contents && !(acceptExisting?.(existingContents) === true)) {
        throw new Error('Existing local notification does not match its persisted outbox event.');
      }
      chmodSync(path, 0o600);
    }
  } catch (error) {
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (ownsTemporaryFile) {
      try { unlinkSync(temporaryPath); } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
}
