import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCTOR_DIRECTORY_LIMIT, isApprovedVerifiedDoctor, normalizeDoctorDirectory } from '../../src/app-functions/patient-doctor-relationship/patient-relations.js';

const approvedDoctor = { physicianId: 'doctor-1', displayName: 'Dr. Example', approved: true, emailVerified: true };

test('directory accepts only approved doctors with verified email and bounds results', () => {
  assert.equal(DOCTOR_DIRECTORY_LIMIT, 25);
  assert.deepEqual(normalizeDoctorDirectory({ doctors: [approvedDoctor], limit: 25, offset: 0, hasMore: true }), { doctors: [approvedDoctor], hasMore: true });
  assert.equal(isApprovedVerifiedDoctor({ ...approvedDoctor, approved: false }), false);
  assert.equal(isApprovedVerifiedDoctor({ ...approvedDoctor, emailVerified: false }), false);
  assert.throws(() => normalizeDoctorDirectory({ doctors: [{ ...approvedDoctor, emailVerified: false }] }));
  assert.throws(() => normalizeDoctorDirectory({ doctors: Array(26).fill(approvedDoctor), limit: 25, offset: 0, hasMore: true }));
  assert.throws(() => normalizeDoctorDirectory({ doctors: [approvedDoctor], limit: 25, offset: 25, hasMore: false }, 0));
});
