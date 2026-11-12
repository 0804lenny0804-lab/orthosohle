import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDisplayPreferenceClasses, defaultDisplayPreferences, displayPreferenceClasses,
  loadDisplayPreferences, saveDisplayPreferences
} from '../src/features/settings/local-preferences.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test('preferences default safely and class mapping makes valid selections visible', () => {
  const storage = createStorage();
  assert.deepEqual(loadDisplayPreferences(storage, 'account-a'), defaultDisplayPreferences());
  assert.deepEqual(displayPreferenceClasses({ contrast: 'high', textSize: 'large' }), {
    'display-contrast-high': true, 'display-text-large': true
  });
});

test('unknown values and malformed stored data fall back to safe defaults', () => {
  const storage = createStorage({
    'orthosohle:display-preferences:v1:account-a': '{bad json',
    'orthosohle:display-preferences:v1:account-b': JSON.stringify({ contrast: 'neon', textSize: 'tiny' })
  });
  assert.deepEqual(loadDisplayPreferences(storage, 'account-a'), defaultDisplayPreferences());
  assert.deepEqual(loadDisplayPreferences(storage, 'account-b'), defaultDisplayPreferences());
  assert.deepEqual(loadDisplayPreferences(storage, ''), defaultDisplayPreferences());
});

test('preferences persist locally per account without crossing identities', () => {
  const storage = createStorage();
  const selected = { contrast: 'high', textSize: 'large' };
  assert.equal(saveDisplayPreferences(storage, 'account/a', selected), true);
  assert.deepEqual(loadDisplayPreferences(storage, 'account/a'), selected);
  assert.deepEqual(loadDisplayPreferences(storage, 'account-b'), defaultDisplayPreferences());
  assert.equal(saveDisplayPreferences(storage, '', selected), false);
  assert.equal(storage.values.size, 1);
});

test('unavailable storage reports failure without throwing', () => {
  const account = 'blocked-storage-account';
  assert.equal(saveDisplayPreferences(null, account, { contrast: 'high', textSize: 'large' }), false);
  assert.deepEqual(loadDisplayPreferences({ getItem() { throw new Error('blocked'); } }, account), { contrast: 'high', textSize: 'large' });
  assert.deepEqual(loadDisplayPreferences(null, 'other-blocked-account'), defaultDisplayPreferences());
});

test('navigation keeps the active preference; logout clears global classes', () => {
  const storage = createStorage();
  const classes = new Set();
  const classList = {
    add(value) { classes.add(value); },
    remove(...values) { values.forEach(value => classes.delete(value)); }
  };
  saveDisplayPreferences(storage, 'navigation-account', { contrast: 'high', textSize: 'large' });

  // Remounting the settings view reads the same account preference.
  applyDisplayPreferenceClasses(classList, 'navigation-account', loadDisplayPreferences(storage, 'navigation-account'));
  assert.deepEqual([...classes].sort(), ['display-contrast-high', 'display-text-large']);
  applyDisplayPreferenceClasses(classList, '', defaultDisplayPreferences());
  assert.deepEqual([...classes], []);
});

test('remount restores an in-memory choice when localStorage is blocked', () => {
  const identityId = 'remount-blocked-account';
  const classes = new Set();
  const classList = {
    add(value) { classes.add(value); },
    remove(...values) { values.forEach(value => classes.delete(value)); }
  };

  // First SettingsView mount changes the choice; browser storage is unavailable.
  assert.equal(saveDisplayPreferences(null, identityId, { contrast: 'high', textSize: 'large' }), false);
  // Unmounting does not clear account-scoped memory; a new SettingsView loads it.
  const preferencesAfterRemount = loadDisplayPreferences(null, identityId);
  assert.deepEqual(preferencesAfterRemount, { contrast: 'high', textSize: 'large' });
  applyDisplayPreferenceClasses(classList, identityId, preferencesAfterRemount);
  assert.deepEqual([...classes].sort(), ['display-contrast-high', 'display-text-large']);
  // The global owner clears the classes when the identity becomes anonymous.
  applyDisplayPreferenceClasses(classList, '', defaultDisplayPreferences());
  assert.deepEqual([...classes], []);
});

test('a failed write keeps the newer account preference ahead of a stale readable value', () => {
  const identityId = 'quota-account';
  const key = `orthosohle:display-preferences:v1:${identityId}`;
  const stale = { contrast: 'standard', textSize: 'standard' };
  const selected = { contrast: 'high', textSize: 'large' };
  const storage = {
    getItem(requestedKey) { return requestedKey === key ? JSON.stringify(stale) : null; },
    setItem() { throw new Error('quota exceeded'); }
  };

  assert.deepEqual(loadDisplayPreferences(storage, identityId), stale);
  assert.equal(saveDisplayPreferences(storage, identityId, selected), false);
  // A view remount can still read storage, but must prefer the newer failed-write override.
  assert.deepEqual(loadDisplayPreferences(storage, identityId), selected);
  assert.deepEqual(loadDisplayPreferences(storage, 'unrelated-quota-account'), defaultDisplayPreferences());
});
