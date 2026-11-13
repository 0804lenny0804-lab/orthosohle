import assert from 'node:assert/strict';
import test from 'node:test';
import { accountIntentDestination, accountIntentDescription } from '../src/features/account/account-intent.js';

test('patient and physician intent only chooses the next view after the shared login', () => {
  assert.equal(accountIntentDestination('patient'), 'patient');
  assert.equal(accountIntentDestination('physician'), 'physician');
  assert.equal(accountIntentDestination('unknown'), 'patient');
  assert.match(accountIntentDescription('physician'), /separate Prüfung und ausdrückliche Freigabe/);
  assert.match(accountIntentDescription('patient'), /dieselbe sichere Anmeldung|E-Mail|Konto/i);
  assert.doesNotMatch(accountIntentDescription('physician'), /freigegeben|Arztzugriff erhalten/i);
});
