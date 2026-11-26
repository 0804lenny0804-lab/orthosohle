import { authRequest } from '../account/account-api.js';
import { DOCTOR_DIRECTORY_LIMIT } from './patient-relations.js';

// Proposed contract pending backend implementation; all authorization remains server-side.
export const careApi = {
  inviteDoctor(physicianEmail) { return authRequest('/api/care/patient/invitations', { physicianEmail }); },
  listDoctorDirectory(offset = 0, limit = DOCTOR_DIRECTORY_LIMIT) {
    const boundedLimit = Math.min(DOCTOR_DIRECTORY_LIMIT, Math.max(1, Math.floor(Number(limit) || DOCTOR_DIRECTORY_LIMIT)));
    const boundedOffset = Math.max(0, Math.min(1000000, Math.floor(Number(offset) || 0)));
    return authRequest(`/api/care/patient/doctors?limit=${boundedLimit}&offset=${boundedOffset}`);
  },
  inviteDirectoryDoctor(physicianId) {
    return authRequest('/api/care/patient/invitations', { physicianId });
  },
  listDoctorInvitations() { return authRequest('/api/care/physician/invitations'); },
  respondToDoctorInvitation(id, action) { return authRequest(`/api/care/physician/invitations/${encodeURIComponent(id)}/${action}`, {}); },
  listPhysicianPatients() {
    return authRequest('/api/care/physician/patients');
  },
  invitePatient(patientEmail) {
    return authRequest('/api/care/invitations', { patientEmail });
  },
  getPatientCare() {
    return authRequest('/api/care/patient');
  },
  acceptInvitation(invitationId) {
    return authRequest(`/api/care/invitations/${encodeURIComponent(invitationId)}/accept`, {});
  },
  declineInvitation(invitationId) {
    return authRequest(`/api/care/invitations/${encodeURIComponent(invitationId)}/decline`, {});
  },
};
