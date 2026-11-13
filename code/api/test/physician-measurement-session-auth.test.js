import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, signUp, signIn, cookies, account } from './test-support.js';

const ORIGIN = 'http://127.0.0.1:5173';
const physicianAccount = { ...account, email: 'synthetic-physician@example.invalid' };
const patientAccount = { ...account, email: 'synthetic-patient@example.invalid' };
const measurementId = '55555555-5555-4555-8555-555555555555';
const historicalMeasurementId = '77777777-7777-4777-8777-777777777777';

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, buffer = 0;
  const bytes = [];
  for (const character of value.toUpperCase()) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid base32 test fixture');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) { bytes.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return String.fromCharCode(...bytes);
}

test('physician route accepts a real Better Auth session with a current database-backed TOTP proof', async t => {
  const f = await fixture(t);
  const physicianId = await signUp(f, true, physicianAccount);
  const patientUserId = await signUp(f, true, patientAccount);
  const initialCookie = cookies(await signIn(f, account.password, physicianAccount));
  const setup = await f.request('/api/auth/two-factor/enable', {
    cookie: initialCookie, body: { password: account.password, method: 'totp' },
  });
  assert.equal(setup.status, 200);
  const secret = decodeBase32(new URL((await setup.json()).totpURI).searchParams.get('secret'));
  const activationCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const enabled = await f.request('/api/auth/two-factor/verify-totp', { cookie: initialCookie, body: { code: activationCode } });
  assert.equal(enabled.status, 200);
  const cookie = cookies(enabled);
  const proofCode = (await f.auth.api.generateTOTP({ body: { secret } })).code;
  const proof = await f.request('/api/step-up/verify', { cookie, body: { code: proofCode }, origin: ORIGIN });
  assert.equal(proof.status, 200, await proof.clone().text());

  const patientProfile = '66666666-6666-4666-8666-666666666666';
  f.database.prepare('INSERT INTO patient_profile (id, account_user_id, created_at) VALUES (?, ?, ?)')
    .run(patientProfile, patientUserId, new Date().toISOString());
  f.database.prepare("INSERT INTO physician_review_application (id, account_user_id, status, requested_at) VALUES (?, ?, 'approved', ?)")
    .run('real-approved-application', physicianId, new Date().toISOString());
  f.database.prepare(`INSERT INTO patient_invitation
    (id, physician_user_id, patient_profile_id, target_user_id, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'accepted', ?, ?)`)
    .run('real-invitation', physicianId, patientProfile, patientUserId, new Date().toISOString(), new Date(Date.now() + 60_000).toISOString());
  f.database.prepare(`INSERT INTO patient_relation
    (id, physician_user_id, patient_profile_id, invitation_id, status, started_at)
    VALUES (?, ?, ?, ?, 'active', ?)`)
    .run('real-relation', physicianId, patientProfile, 'real-invitation', new Date().toISOString());
  f.database.prepare(`INSERT INTO measurement_session
    (id, patient_profile_id, source, started_at, ended_at, payload_hash, created_at)
    VALUES (?, ?, 'ble', ?, ?, 'synthetic', ?)`)
    .run(measurementId, patientProfile, '2026-11-11T10:00:00.000Z', '2026-11-11T10:00:02.000Z', new Date().toISOString());
  f.database.prepare(`INSERT INTO measurement_interval (session_id, received_at, sample_count, average, maximum)
    VALUES (?, '2026-11-11T10:00:01.000Z', 2, 4, 6)`).run(measurementId);
  f.database.prepare(`INSERT INTO measurement_session
    (id, patient_profile_id, source, started_at, ended_at, payload_hash, created_at)
    VALUES (?, ?, 'ble', '2026-11-10T10:00:00.000Z', '2026-11-10T10:00:02.000Z', 'historical', ?)`)
    .run(historicalMeasurementId, patientProfile, new Date().toISOString());
  f.database.prepare(`INSERT INTO measurement_interval (session_id, received_at, sample_count, average, maximum)
    VALUES (?, '2026-11-10T10:00:01.000Z', 2, 3, 5)`).run(historicalMeasurementId);

  const listPath = `/api/care/physician/patients/${patientProfile}/measurement-sessions`;
  const listed = await f.request(listPath, { cookie });
  assert.equal(listed.status, 200, await listed.clone().text());
  const list = await listed.json();
  assert.deepEqual(list.sessions.map(session => session.id), [measurementId, historicalMeasurementId]);
  const response = await f.request(`${listPath}/${measurementId}`, { cookie });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).session.id, measurementId);
  const historical = await f.request(`${listPath}/${historicalMeasurementId}`, { cookie });
  assert.equal(historical.status, 200);
  assert.equal((await historical.json()).session.id, historicalMeasurementId);
  f.database.prepare("UPDATE physician_review_application SET status = 'revoked' WHERE account_user_id = ?").run(physicianId);
  const afterRevocation = await f.request(`${listPath}/${measurementId}`, { cookie });
  assert.equal(afterRevocation.status, 403);
});
