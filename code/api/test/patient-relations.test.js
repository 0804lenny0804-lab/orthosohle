import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { migratePatientRelations, createPatientRelationsRepository } from '../src/patient-relations.js';

function fixture() {
  const database = new Database(':memory:');
  database.exec(`CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, emailVerified INTEGER, name TEXT);
    CREATE TABLE patient_profile (id TEXT PRIMARY KEY, account_user_id TEXT UNIQUE REFERENCES user(id));`);
  const users = database.prepare('INSERT INTO user VALUES (?, ?, 1, ?)');
  const profile = database.prepare('INSERT INTO patient_profile VALUES (?, ?)');
  for (const [id, email, name] of [
    ['doctor-a', 'a@example.invalid', 'Doctor A'], ['doctor-b', 'b@example.invalid', 'Doctor B'],
    ['patient-a', 'pa@example.invalid', 'Patient A'], ['patient-b', 'pb@example.invalid', 'Patient B'],
  ]) users.run(id, email, name);
  profile.run('profile-a', 'patient-a');
  profile.run('profile-b', 'patient-b');
  migratePatientRelations(database);
  return { database, relations: createPatientRelationsRepository(database) };
}

function invite(relations, physicianUserId, patientProfileId, targetUserId, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  return relations.createInvitation({ physicianUserId, patientProfileId, targetUserId, expiresAt });
}
const approvedPhysician = () => true;

test('invitation alone grants no relationship; only the exact target can accept', () => {
  const { database, relations } = fixture();
  const invitation = invite(relations, 'doctor-a', 'profile-a', 'patient-a').invitation;
  assert.equal(relations.findActiveForPatient('profile-a'), null);
  assert.equal(relations.acceptInvitation(invitation.id, 'patient-b', approvedPhysician).kind, 'not_found');
  assert.equal(relations.findActiveForPatient('profile-a'), null);
  assert.equal(relations.acceptInvitation(invitation.id, 'patient-a', approvedPhysician).kind, 'accepted');
  assert.equal(relations.hasActiveRelationship('doctor-a', 'profile-a'), true);
  assert.equal(relations.hasActiveRelationship('doctor-b', 'profile-a'), false);
  database.close();
});

test('exact verified email target binding rejects foreign profile and unverified accounts', () => {
  const { database, relations } = fixture();
  assert.equal(relations.findProfileForExactEmail('pa@example.invalid').patientProfileId, 'profile-a');
  assert.equal(relations.findProfileForExactEmail('PA@example.invalid'), null);
    database.prepare('UPDATE user SET emailVerified = 0 WHERE id = ?').run('patient-a');
  assert.equal(relations.findProfileForExactEmail('pa@example.invalid'), null);
  database.close();
});

test('competing explicit acceptances switch atomically and retain a single active physician', async () => {
  const { database, relations } = fixture();
  const first = invite(relations, 'doctor-a', 'profile-a', 'patient-a').invitation;
  const second = invite(relations, 'doctor-b', 'profile-a', 'patient-a').invitation;
  const results = await Promise.all([
    Promise.resolve().then(() => relations.acceptInvitation(first.id, 'patient-a', approvedPhysician)),
    Promise.resolve().then(() => relations.acceptInvitation(second.id, 'patient-a', approvedPhysician)),
  ]);
  assert.equal(results.filter(result => result.kind === 'accepted').length, 2);
  assert.equal(database.prepare("SELECT count(*) AS n FROM patient_relation WHERE status = 'active'").get().n, 1);
  assert.equal(database.prepare("SELECT count(*) AS n FROM patient_relation WHERE status = 'ended'").get().n, 1);
  assert.equal(relations.hasActiveRelationship('doctor-a', 'profile-a') || relations.hasActiveRelationship('doctor-b', 'profile-a'), true);
  assert.equal(relations.hasActiveRelationship('doctor-a', 'profile-a') && relations.hasActiveRelationship('doctor-b', 'profile-a'), false);
  database.close();
});

test('expired and replayed invitations cannot create another relationship', () => {
  const { database, relations } = fixture();
  const expired = invite(relations, 'doctor-a', 'profile-a', 'patient-a', '2000-01-01T00:00:00.000Z').invitation;
  assert.equal(relations.acceptInvitation(expired.id, 'patient-a', approvedPhysician).kind, 'expired');
  const valid = invite(relations, 'doctor-b', 'profile-b', 'patient-b').invitation;
  assert.equal(relations.acceptInvitation(valid.id, 'patient-b', approvedPhysician).kind, 'accepted');
  assert.equal(relations.acceptInvitation(valid.id, 'patient-b', approvedPhysician).kind, 'not_open');
  database.close();
});

test('missing or revoked live physician authorization blocks acceptance without consuming invite', () => {
  const { database, relations } = fixture();
  const invitation = invite(relations, 'doctor-a', 'profile-a', 'patient-a').invitation;
  assert.equal(relations.acceptInvitation(invitation.id, 'patient-a').kind, 'physician_not_approved');
  assert.equal(relations.findInvitationForTarget(invitation.id, 'patient-a').status, 'open');
  assert.equal(relations.acceptInvitation(invitation.id, 'patient-a', () => false).kind, 'physician_not_approved');
  assert.equal(relations.findActiveForPatient('profile-a'), null);
  database.close();
});

test('only the invited patient can decline; decline never changes an active relationship', () => {
  const { database, relations } = fixture();
  const established = invite(relations, 'doctor-a', 'profile-a', 'patient-a').invitation;
  assert.equal(relations.acceptInvitation(established.id, 'patient-a', approvedPhysician).kind, 'accepted');
  const pendingSwitch = invite(relations, 'doctor-b', 'profile-a', 'patient-a').invitation;
  assert.equal(relations.declineInvitation(pendingSwitch.id, 'patient-b').kind, 'not_found');
  assert.equal(relations.declineInvitation(pendingSwitch.id, 'patient-a').kind, 'declined');
  assert.equal(relations.acceptInvitation(pendingSwitch.id, 'patient-a', approvedPhysician).kind, 'not_open');
  assert.equal(relations.hasActiveRelationship('doctor-a', 'profile-a'), true);
  assert.equal(relations.hasActiveRelationship('doctor-b', 'profile-a'), false);
  assert.equal(relations.findInvitationForTarget(pendingSwitch.id, 'patient-a').status, 'declined');
  database.close();
});

test('decline and acceptance race has one terminal outcome and one active relationship', async () => {
  const { database, relations } = fixture();
  const established = invite(relations, 'doctor-a', 'profile-a', 'patient-a').invitation;
  relations.acceptInvitation(established.id, 'patient-a', approvedPhysician);
  const pendingSwitch = invite(relations, 'doctor-b', 'profile-a', 'patient-a').invitation;
  const results = await Promise.all([
    Promise.resolve().then(() => relations.declineInvitation(pendingSwitch.id, 'patient-a')),
    Promise.resolve().then(() => relations.acceptInvitation(pendingSwitch.id, 'patient-a', approvedPhysician)),
  ]);
  assert.equal(results.filter(result => ['accepted', 'declined'].includes(result.kind)).length, 1);
  assert.equal(database.prepare("SELECT count(*) AS n FROM patient_relation WHERE status = 'active'").get().n, 1);
  const current = relations.findInvitationForTarget(pendingSwitch.id, 'patient-a');
  assert.ok(['accepted', 'declined'].includes(current.status));
  if (current.status === 'declined') assert.equal(relations.hasActiveRelationship('doctor-a', 'profile-a'), true);
  else assert.equal(relations.hasActiveRelationship('doctor-b', 'profile-a'), true);
  database.close();
});
