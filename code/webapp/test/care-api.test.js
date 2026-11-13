import test from 'node:test';
import assert from 'node:assert/strict';
import { careApi } from '../src/features/care/care-api.js';
import { acceptInvitationRequest, declineInvitationRequest, isCreatedInvitation } from '../src/features/care/care-state.js';

test('explicit patient acceptance invokes API only for an open invitation', async () => {
  const accepted = [];
  const api = { acceptInvitation: async id => { accepted.push(id); return { ok: true }; } };
  assert.equal(await acceptInvitationRequest({ id: 'invite-1', status: 'pending' }, api), null);
  assert.equal(await acceptInvitationRequest({ id: 'invite-2', status: 'open' }, api).then(result => result.ok), true);
  assert.equal(await declineInvitationRequest({ id: 'invite-3', status: 'open' }, {
    declineInvitation: async id => { accepted.push(`declined:${id}`); return { ok: true }; },
  }).then(result => result.ok), true);
  assert.equal(isCreatedInvitation({ id: 'invite-4', status: 'open', expiresAt: '2026-11-12T00:00:00Z' }), true);
  assert.equal(isCreatedInvitation({ id: 'invite-4', status: 'pending', expiresAt: '2026-11-12T00:00:00Z' }), false);
  assert.deepEqual(accepted, ['invite-2', 'declined:invite-3']);
});

test('care API uses same-origin session requests and encodes invitation IDs', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await careApi.listPhysicianPatients();
  await careApi.invitePatient('patient@example.invalid');
  await careApi.getPatientCare();
  await careApi.acceptInvitation('invite/one');
  await careApi.declineInvitation('invite/one');

  assert.deepEqual(calls.map(call => call.path), [
    '/api/care/physician/patients',
    '/api/care/invitations',
    '/api/care/patient',
    '/api/care/invitations/invite%2Fone/accept',
    '/api/care/invitations/invite%2Fone/decline',
  ]);
  assert.ok(calls.every(call => call.options.credentials === 'same-origin'));
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { patientEmail: 'patient@example.invalid' });
  assert.equal(calls[3].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[3].options.body), {});
  assert.equal(calls[4].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[4].options.body), {});
});
