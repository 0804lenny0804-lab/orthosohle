import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountIntentDestination,
  accountIntentDescription,
  intentAfterIdentityChange,
  resolveNavigation,
} from '../../src/app-functions/account/account-intent.js';

test('patient and physician intent only chooses the next view after the shared login', () => {
  assert.equal(accountIntentDestination('patient'), 'patient');
  assert.equal(accountIntentDestination('physician'), 'physician');
  assert.equal(accountIntentDestination('unknown'), 'patient');
  assert.match(accountIntentDescription('physician'), /separate Prüfung und ausdrückliche Freigabe/);
  assert.match(accountIntentDescription('patient'), /dieselbe sichere Anmeldung|E-Mail|Konto/i);
  assert.doesNotMatch(accountIntentDescription('physician'), /freigegeben|Arztzugriff erhalten/i);
});

test('physician navigation is confined to the patient workspace and identity changes clear the UI preference', () => {
  assert.equal(resolveNavigation('physician', 'account'), 'account');
  assert.equal(resolveNavigation('physician', 'history'), 'account');
  assert.equal(resolveNavigation('patient', 'history'), 'history');
  assert.equal(resolveNavigation('patient', 'unknown'), 'account');
  assert.equal(intentAfterIdentityChange('physician', '', 'user-a'), 'physician');
  assert.equal(intentAfterIdentityChange('physician', 'user-a', 'user-a'), 'physician');
  assert.equal(intentAfterIdentityChange('physician', 'user-a', 'user-b'), 'patient');
  assert.equal(intentAfterIdentityChange('physician', 'user-a', ''), 'patient');
});
