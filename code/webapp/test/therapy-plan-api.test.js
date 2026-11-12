import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTherapyLimit, parsePatientPlan, parsePhysicianPlans, therapyPlanApi } from '../src/features/care/therapy-plan-api.js';

const plan = {
  id: 'plan-1', patientId: 'patient-1', relationshipId: 'relationship-1', version: 1, limitKg: 12.5, unit: 'kg',
  authoredBy: 'physician-internal-1', authorName: 'Dr. Beispiel', createdAt: '2026-11-12T12:00:00.000Z',
};

test('therapy plan API scopes requests and includes expected version for safe creation', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify(calls.length === 1 ? { plans: [plan], currentVersion: 1 } : { plan }), {
      status: calls.length === 1 ? 200 : 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(await therapyPlanApi.listForPhysician('patient/one'), { plans: [plan], currentVersion: 1 });
  assert.equal((await therapyPlanApi.createForPhysician('patient/one', 12.5, 1)).plan.id, plan.id);
  assert.equal(calls[0].path, '/api/care/physician/patients/patient%2Fone/therapy-plans');
  assert.deepEqual(JSON.parse(calls[1].options.body), { limitKg: 12.5, expectedVersion: 1 });
  assert.ok(calls.every(({ options }) => options.credentials === 'same-origin' && options.cache === 'no-store'));
});

test('patient plan and explicit confirmation use only patient endpoints', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    const body = calls.length === 1 ? { plan, confirmedAt: null, relationship: { relationshipId: plan.relationshipId, physicianUserId: 'doctor-1', status: 'active', physicianApprovalStatus: 'approved' }, previousPlanStatus: null }
      : { confirmation: { versionId: plan.id, confirmedAt: '2026-11-12T12:01:00.000Z', alreadyConfirmed: false } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(parsePatientPlan(await therapyPlanApi.getForPatient()), {
    plan, confirmedAt: null,
    relationship: { relationshipId: plan.relationshipId, physicianUserId: 'doctor-1', status: 'active', physicianApprovalStatus: 'approved' },
    previousPlanStatus: null,
  });
  assert.equal((await therapyPlanApi.confirmForPatient(plan.id)).confirmation.versionId, plan.id);
  assert.equal(calls[0].path, '/api/care/patient/therapy-plan');
  assert.equal(calls[1].path, '/api/care/patient/therapy-plan/confirm');
  assert.deepEqual(JSON.parse(calls[1].options.body), { versionId: plan.id });
});

test('malformed plans, unsupported units and confirmation without a plan are rejected', () => {
  assert.throws(() => parsePhysicianPlans({ plans: [{ ...plan, version: 0 }], currentVersion: null }), /ungültige Planhistorie/);
  assert.throws(() => parsePatientPlan({ plan: { ...plan, unit: 'lb' }, confirmedAt: null, relationship: null, previousPlanStatus: null }), /ungültigen Therapieplan/);
  assert.throws(() => parsePatientPlan({ plan: null, confirmedAt: plan.createdAt, relationship: null, previousPlanStatus: null }), /Bestätigung ohne aktuellen Plan/);
  assert.equal(parsePatientPlan({ plan: null, confirmedAt: null, relationship: null, previousPlanStatus: 'continuation_undetermined' }).previousPlanStatus, 'continuation_undetermined');
});

test('therapy limit validation tolerates floating point representation while enforcing thousandths', () => {
  assert.equal(isValidTherapyLimit(1.001), true);
  assert.equal(isValidTherapyLimit(1.0001), false);
  assert.equal(isValidTherapyLimit(1_000_000), true);
  assert.equal(isValidTherapyLimit(1_000_000.001), false);
});

test('patient relationship status retains revocation and only displays an old-plan continuation warning', () => {
  const parsed = parsePatientPlan({
    plan: null,
    confirmedAt: null,
    relationship: { relationshipId: 'new-relation', physicianUserId: 'doctor-2', status: 'active', physicianApprovalStatus: 'revoked' },
    previousPlanStatus: 'continuation_undetermined',
  });
  assert.equal(parsed.relationship.physicianApprovalStatus, 'revoked');
  assert.equal(parsed.previousPlanStatus, 'continuation_undetermined');
});

test('a late response for the previous patient cannot pass the request identity guard', async () => {
  let generation = 2;
  let selectedPatientId = 'patient-a';
  const mounted = true;
  const isCurrent = (request, identity, patientId = '') => mounted && generation === request
    && identity === 'doctor-a' && patientId === selectedPatientId;
  const request = generation;
  let finish;
  const late = new Promise(resolve => { finish = resolve; }).then(value => isCurrent(request, 'doctor-a', 'patient-a') ? value : null);
  generation += 1;
  selectedPatientId = 'patient-b';
  finish(plan);
  assert.equal(await late, null);
});

test('late responses cannot restore data after account switch or unmount', async () => {
  let generation = 9;
  let identity = 'account-a';
  let mounted = true;
  const current = request => mounted && request === generation && identity === 'account-a';
  const request = generation;
  const late = Promise.resolve(plan).then(value => current(request) ? value : null);
  generation += 1;
  identity = 'account-b';
  mounted = false;
  assert.equal(await late, null);
});
