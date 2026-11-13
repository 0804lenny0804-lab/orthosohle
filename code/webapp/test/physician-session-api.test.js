import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPhysicianMeasurementSession, fetchPhysicianMeasurementSessions, isPhysicianSessionAccessError } from '../src/features/care/physician-session-api.js';
import {
  physicianAccessErrorMessage,
  physicianDetailRequestIsCurrent,
  physicianRequestIsCurrent,
  shouldReportCareAccessError,
  shouldClosePhysicianAccessOnResume,
} from '../src/features/care/physician-session-requests.js';

const session = {
  id: 'session-1',
  source: 'simulation',
  startedAt: '2026-11-10T10:00:00.000Z',
  endedAt: '2026-11-10T10:00:02.000Z',
  samples: [{ timestamp: '2026-11-10T10:00:00.000Z', avg: 4.5, max: 5, count: 2 }],
  gaps: [],
};

test('physician session API scopes both requests to the selected patient and paginates summaries', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    const body = calls.length === 1
      ? { sessions: [{ id: session.id, source: session.source, startedAt: session.startedAt, endedAt: session.endedAt }], nextBefore: { id: session.id, startedAt: session.startedAt } }
      : { session };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const page = await fetchPhysicianMeasurementSessions('patient/one');
  const detail = await fetchPhysicianMeasurementSession('patient/one', 'session/one');

  assert.deepEqual(page.sessions.map(item => item.id), ['session-1']);
  assert.deepEqual(page.nextBefore, { id: session.id, startedAt: session.startedAt });
  assert.equal(detail.samples[0].avg, 4.5);
  assert.equal(calls[0].path, '/api/care/physician/patients/patient%2Fone/measurement-sessions?limit=50');
  assert.equal(calls[1].path, '/api/care/physician/patients/patient%2Fone/measurement-sessions/session%2Fone');
  assert.ok(calls.every(({ options }) => options.credentials === 'same-origin' && options.cache === 'no-store'));
});

test('physician session API rejects malformed server summaries and incomplete details', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async path => new Response(JSON.stringify(path.includes('?limit=')
    ? { sessions: [{ ...session, source: 'unknown' }], nextBefore: null }
    : { session: { ...session, samples: undefined } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(fetchPhysicianMeasurementSessions('patient-1'), /ungültige Sitzung/);
  await assert.rejects(fetchPhysicianMeasurementSession('patient-1', 'session-1'), /keine vollständigen Sitzungsdetails/);
});

test('a late response for the previous patient cannot restore its sessions after switching patients', async () => {
  let generation = 4;
  let selectedPatientId = 'patient-a';
  let visibleSessions = [];
  const request = {
    mounted: true,
    requestGeneration: generation,
    currentGeneration: generation,
    requestIdentity: 'doctor-a',
    currentIdentity: 'doctor-a',
    requestPatientId: selectedPatientId,
    currentPatientId: selectedPatientId,
  };
  let finishOldRequest;
  const oldRequest = new Promise(resolve => { finishOldRequest = resolve; });
  const pendingWrite = oldRequest.then(result => {
    if (physicianRequestIsCurrent({ ...request, currentGeneration: generation, currentPatientId: selectedPatientId })) {
      visibleSessions = result;
    }
  });

  generation += 1;
  selectedPatientId = 'patient-b';
  visibleSessions = [{ id: 'patient-b-session' }];
  finishOldRequest([{ id: 'patient-a-session' }]);
  await pendingWrite;

  assert.deepEqual(visibleSessions, [{ id: 'patient-b-session' }]);
});

test('authorization and relationship errors are identified for immediate UI clearing', () => {
  for (const status of [401, 403, 404]) assert.equal(isPhysicianSessionAccessError({ status }), true);
  assert.equal(isPhysicianSessionAccessError({ status: 500 }), false);
});

test('closing and reopening the same session invalidates the earlier detail response', () => {
  const requestContext = {
    mounted: true,
    requestGeneration: 7,
    currentGeneration: 7,
    requestIdentity: 'doctor-a',
    currentIdentity: 'doctor-a',
    requestPatientId: 'patient-a',
    currentPatientId: 'patient-a',
  };
  const oldDetailRequest = {
    ...requestContext,
    detailRequestGeneration: 12,
    currentDetailRequestGeneration: 14,
    sessionId: 'session-a',
    selectedSessionId: 'session-a',
  };

  assert.equal(physicianDetailRequestIsCurrent(oldDetailRequest), false);
  assert.equal(physicianDetailRequestIsCurrent({
    ...oldDetailRequest,
    detailRequestGeneration: 14,
    currentDetailRequestGeneration: 14,
  }), true);
});

test('account and physician authorization messages distinguish authentication from access errors', () => {
  assert.match(physicianAccessErrorMessage(401, { accountStatus: 'anonymous', sessionChecked: true }), /Anmeldung ist abgelaufen/);
  assert.match(physicianAccessErrorMessage(401, { accountStatus: 'authenticated', sessionChecked: true }), /Anmeldung ist weiterhin gültig/);
  assert.match(physicianAccessErrorMessage(401, { accountStatus: 'unavailable', sessionChecked: false }), /Anmeldestatus konnte nicht bestätigt werden/);
  assert.match(physicianAccessErrorMessage(403), /Arztzugriff abgelehnt/);
  const notFound = physicianAccessErrorMessage(404);
  assert.match(notFound, /Sitzung oder aktive Patientenzuordnung ist nicht verfügbar/);
  assert.doesNotMatch(notFound, /Anmeldung ist abgelaufen/);
});

test('physician access closes on focus or return to a visible tab, with listener policy guarded by active step-up', () => {
  assert.equal(shouldClosePhysicianAccessOnResume({ active: true, eventType: 'focus' }), true);
  assert.equal(shouldClosePhysicianAccessOnResume({ active: true, eventType: 'visibilitychange', visibilityState: 'visible' }), true);
  assert.equal(shouldClosePhysicianAccessOnResume({ active: true, eventType: 'visibilitychange', visibilityState: 'hidden' }), false);
  assert.equal(shouldClosePhysicianAccessOnResume({ active: false, eventType: 'focus' }), false);
});

test('only physician care authentication and authorization errors escalate to AccountView', () => {
  assert.equal(shouldReportCareAccessError('physician', 401), true);
  assert.equal(shouldReportCareAccessError('physician', 403), true);
  assert.equal(shouldReportCareAccessError('physician', 404), false);
  assert.equal(shouldReportCareAccessError('patient', 401), false);
  assert.equal(shouldReportCareAccessError('patient', 403), false);
  assert.equal(shouldReportCareAccessError('physician', 500), false);
});
