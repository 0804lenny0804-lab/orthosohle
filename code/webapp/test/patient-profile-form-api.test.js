import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEditableProfile, patientProfileFormApi } from '../src/features/account/patient-profile-form-api.js';

test('patient profile API scopes own and assigned patient paths and encodes ids', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ profile: null }); };
  await patientProfileFormApi.get('patient');
  await patientProfileFormApi.get('physician', 'patient/one');
  await patientProfileFormApi.patch('physician', 'patient/one', { expectedVersion: 0, injury: null });
  assert.equal(calls[0].url, '/api/patient-profile');
  assert.equal(calls[1].url, '/api/patient-profile/physician/patient%2Fone');
  assert.deepEqual(JSON.parse(calls[2].options.body), { expectedVersion: 0, injury: null });
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[2].options.method, 'PATCH');
});

test('profile parser accepts empty state and validates versioned fields', () => {
  assert.equal(parseEditableProfile({ profile: null }), null);
  assert.deepEqual(parseEditableProfile({ profile: { id: 'p1', version: 0, injury: null, weightKg: null } }),
    { id: 'p1', version: 0, injury: null, weightKg: null });
  assert.throws(() => parseEditableProfile({ profile: { id: 'p1', version: -1 } }), /ungültiges Patientenprofil/);
});
