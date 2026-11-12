import assert from 'node:assert/strict';
import test from 'node:test';
import { cookies, fixture, signIn, signUp, account } from './test-support.js';
import { migratePatientRelations } from '../src/patient-relations.js';
import { migrateTherapyPlans } from '../src/therapy-plan.js';
import { migratePatientProfiles } from '../src/patient-profile-migration.js';

const ORIGIN = 'http://127.0.0.1:5173';
const doctor = { ...account, name: 'Synthetic Doctor', email: 'plan-doctor@example.invalid' };
const patient = { ...account, name: 'Synthetic Patient', email: 'plan-patient@example.invalid' };
const otherPatient = { ...account, name: 'Synthetic Other', email: 'plan-other@example.invalid' };

function clearSyntheticRateLimit(f) {
  f.database.prepare('DELETE FROM rateLimit').run();
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, buffer = 0;
  const bytes = [];
  for (const character of value.toUpperCase()) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid synthetic base32 TOTP secret');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) { bytes.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return String.fromCharCode(...bytes);
}

test('Better Auth sessions survive repeatable migration; physician creates, patient confirms, and live authorization is rechecked', async t => {
  const f = await fixture(t);
  const doctorId = await signUp(f, true, doctor);
  const patientId = await signUp(f, true, patient);
  const otherPatientId = await signUp(f, true, otherPatient);
  const setupCookie = cookies(await signIn(f, doctor.password, doctor));
  clearSyntheticRateLimit(f);
  const parallelCookie = cookies(await signIn(f, doctor.password, doctor));
  clearSyntheticRateLimit(f);
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: setupCookie, body: { password: doctor.password, method: 'totp' },
  });
  assert.equal(setup.status, 200, await setup.clone().text());
  const secret = decodeBase32(new URL((await setup.json()).totpURI).searchParams.get('secret'));
  const activationCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const activated = await f.request('/api/auth/two-factor/verify-totp', { cookie: setupCookie, body: { code: activationCode } });
  assert.equal(activated.status, 200, await activated.clone().text());
  const doctorCookie = cookies(activated);
  const proofCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  assert.equal((await f.request('/api/step-up/verify', { cookie: doctorCookie, body: { code: proofCode }, origin: ORIGIN })).status, 200);
  const patientLogin = await signIn(f, patient.password, patient);
  assert.equal(patientLogin.status, 200, await patientLogin.clone().text());
  const patientCookie = cookies(patientLogin);
  clearSyntheticRateLimit(f);
  const otherLogin = await signIn(f, otherPatient.password, otherPatient);
  assert.equal(otherLogin.status, 200, await otherLogin.clone().text());
  const otherCookie = cookies(otherLogin);
  clearSyntheticRateLimit(f);

  const profileResponse = await f.request('/api/patient-profile', { cookie: patientCookie, body: {}, origin: ORIGIN });
  const otherProfileResponse = await f.request('/api/patient-profile', { cookie: otherCookie, body: {}, origin: ORIGIN });
  assert.equal(profileResponse.status, 201);
  assert.equal(otherProfileResponse.status, 201);
  const profileId = (await profileResponse.json()).profile.id;
  const otherProfileId = (await otherProfileResponse.json()).profile.id;
  f.database.prepare("INSERT INTO physician_review_application (id, account_user_id, status, requested_at) VALUES (?, ?, 'approved', ?)")
    .run('plan-doctor-approval', doctorId, new Date().toISOString());
  const now = new Date().toISOString();
  f.database.prepare(`INSERT INTO patient_invitation
    (id, physician_user_id, patient_profile_id, target_user_id, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'accepted', ?, ?)`).run('plan-invitation', doctorId, profileId, patientId, now, new Date(Date.now() + 60_000).toISOString());
  f.database.prepare(`INSERT INTO patient_relation
    (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
    VALUES (?, ?, ?, ?, 'active', ?)`).run('plan-relation', doctorId, profileId, 'plan-invitation', now);

  const sessionCountBefore = f.database.prepare('SELECT count(*) AS n FROM session WHERE userId = ?').get(doctorId).n;
  migratePatientRelations(f.database);
  migrateTherapyPlans(f.database);
  migrateTherapyPlans(f.database);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM session WHERE userId = ?').get(doctorId).n, sessionCountBefore);
  assert.equal((await f.request('/api/me', { cookie: doctorCookie })).status, 200);
  assert.equal((await f.request('/api/care/physician/patients/nope/therapy-plans', { cookie: parallelCookie })).status, 401);

  const createPath = `/api/care/physician/patients/${profileId}/therapy-plans`;
  const created = await f.request(createPath, { cookie: doctorCookie, body: { limitKg: 72.125, expectedVersion: null }, origin: ORIGIN });
  assert.equal(created.status, 201, await created.clone().text());
  const plan = (await created.json()).plan;
  assert.equal(plan.authorName, doctor.name);
  assert.equal(plan.authoredBy, doctorId);
  assert.equal((await f.request(`/api/care/physician/patients/${otherProfileId}/therapy-plans`, { cookie: doctorCookie })).status, 404);
  const patientCurrent = await f.request('/api/care/patient/therapy-plan', { cookie: patientCookie });
  assert.equal(patientCurrent.status, 200);
  assert.equal((await patientCurrent.json()).plan.authorName, doctor.name);
  const wrongPatientConfirm = await f.request('/api/care/patient/therapy-plan/confirm', {
    cookie: otherCookie, body: { versionId: plan.id }, origin: ORIGIN,
  });
  assert.equal(wrongPatientConfirm.status, 409);
  const firstConfirm = await f.request('/api/care/patient/therapy-plan/confirm', {
    cookie: patientCookie, body: { versionId: plan.id }, origin: ORIGIN,
  });
  assert.equal(firstConfirm.status, 200, await firstConfirm.clone().text());
  assert.equal((await firstConfirm.json()).confirmation.alreadyConfirmed, false);

  f.database.prepare("UPDATE physician_review_application SET status = 'revoked' WHERE account_user_id = ?").run(doctorId);
  const revokedView = await f.request('/api/care/patient/therapy-plan', { cookie: patientCookie });
  assert.equal((await revokedView.json()).plan, null);
  assert.equal((await f.request('/api/care/patient/therapy-plan/confirm', {
    cookie: patientCookie, body: { versionId: plan.id }, origin: ORIGIN,
  })).status, 409);
  const doctorHistoryAfterRevocation = await f.request(createPath, { cookie: doctorCookie });
  assert.equal(doctorHistoryAfterRevocation.status, 403);

  f.database.prepare('UPDATE session SET expiresAt = ? WHERE userId = ?').run('2000-01-01T00:00:00.000Z', doctorId);
  const expiredSession = await f.request(createPath, { cookie: doctorCookie });
  assert.equal(expiredSession.status, 401);
});

test('real Better Auth sessions protect patient profile ownership, physician MFA, revisions and revocation', async t => {
  const f = await fixture(t);
  const doctorId = await signUp(f, true, doctor);
  const patientId = await signUp(f, true, patient);
  const otherPatientId = await signUp(f, true, otherPatient);

  const setupCookie = cookies(await signIn(f, doctor.password, doctor));
  clearSyntheticRateLimit(f);
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: setupCookie, body: { password: doctor.password, method: 'totp' },
  });
  assert.equal(setup.status, 200, await setup.clone().text());
  const secret = decodeBase32(new URL((await setup.json()).totpURI).searchParams.get('secret'));
  const activationCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const activated = await f.request('/api/auth/two-factor/verify-totp', { cookie: setupCookie, body: { code: activationCode } });
  assert.equal(activated.status, 200, await activated.clone().text());
  const doctorCookie = cookies(activated);
  const stepUp = await f.request('/api/step-up/verify', {
    cookie: doctorCookie,
    body: { code: (await f.auth.api.generateTOTP({ body: { secret } })).code },
    origin: ORIGIN,
  });
  assert.equal(stepUp.status, 200, await stepUp.clone().text());

  const patientCookie = cookies(await signIn(f, patient.password, patient));
  clearSyntheticRateLimit(f);
  const otherCookie = cookies(await signIn(f, otherPatient.password, otherPatient));
  clearSyntheticRateLimit(f);
  const profileAResponse = await f.request('/api/patient-profile', { cookie: patientCookie, body: {}, origin: ORIGIN });
  const profileBResponse = await f.request('/api/patient-profile', { cookie: otherCookie, body: {}, origin: ORIGIN });
  assert.equal(profileAResponse.status, 201);
  assert.equal(profileBResponse.status, 201);
  const profileA = (await profileAResponse.json()).profile;
  const profileB = (await profileBResponse.json()).profile;
  assert.equal((await (await f.request('/api/patient-profile', { cookie: patientCookie })).json()).profile.id, profileA.id);

  const createdAt = new Date().toISOString();
  f.database.prepare(`INSERT INTO physician_review_application (id, account_user_id, status, requested_at)
    VALUES (?, ?, 'approved', ?)`).run('profile-doctor-approval', doctorId, createdAt);
  f.database.prepare(`INSERT INTO patient_invitation
    (id, physician_user_id, patient_profile_id, target_user_id, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'accepted', ?, ?)`).run('profile-invite', doctorId, profileA.id, patientId,
      createdAt, new Date(Date.now() + 60_000).toISOString());
  f.database.prepare(`INSERT INTO patient_relation
    (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
    VALUES (?, ?, ?, ?, 'active', ?)`).run('profile-relation', doctorId, profileA.id, 'profile-invite', createdAt);

  const physicianPath = `/api/patient-profile/physician/${profileA.id}`;
  assert.equal((await f.request(`/api/patient-profile/physician/${profileB.id}`, { cookie: doctorCookie })).status, 404);
  const patientPatch = await f.request('/api/patient-profile', {
    cookie: patientCookie, body: { expectedVersion: 0, injury: 'synthetic ankle note', weightKg: 68.2 }, origin: ORIGIN,
    method: 'PATCH',
  });
  assert.equal(patientPatch.status, 200, await patientPatch.clone().text());
  const physicianRead = await f.request(physicianPath, { cookie: doctorCookie });
  assert.equal(physicianRead.status, 200);
  assert.equal((await physicianRead.json()).profile.weightKg, 68.2);
  const physicianPatch = await f.request(physicianPath, {
    cookie: doctorCookie, body: { expectedVersion: 1, injury: 'synthetic clinician note' }, origin: ORIGIN,
    method: 'PATCH',
  });
  assert.equal(physicianPatch.status, 200, await physicianPatch.clone().text());
  const patientReload = await f.request('/api/patient-profile', { cookie: patientCookie });
  const reloaded = (await patientReload.json()).profile;
  assert.equal(reloaded.version, 2);
  assert.equal(reloaded.injury, 'synthetic clinician note');
  assert.deepEqual(reloaded.lastChangedBy, { name: doctor.name });

  const sessionCount = f.database.prepare('SELECT count(*) AS count FROM session').get().count;
  migratePatientProfiles(f.database);
  migratePatientProfiles(f.database);
  assert.equal(f.database.prepare('SELECT count(*) AS count FROM session').get().count, sessionCount);
  assert.equal((await (await f.request('/api/patient-profile', { cookie: patientCookie })).json()).profile.injury,
    'synthetic clinician note');
  assert.equal(otherPatientId, f.database.prepare('SELECT account_user_id FROM patient_profile WHERE id = ?').get(profileB.id).account_user_id);

  f.database.prepare("UPDATE patient_relation SET status = 'ended' WHERE id = 'profile-relation'").run();
  assert.equal((await f.request(physicianPath, { cookie: doctorCookie })).status, 404);
  f.database.prepare("UPDATE patient_relation SET status = 'active' WHERE id = 'profile-relation'").run();
  f.database.prepare("UPDATE physician_review_application SET status = 'revoked' WHERE account_user_id = ?").run(doctorId);
  assert.equal((await f.request(physicianPath, { cookie: doctorCookie })).status, 403);
});
