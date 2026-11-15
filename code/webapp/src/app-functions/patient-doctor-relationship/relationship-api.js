import { authRequest } from '../account/account-api.js';

// Proposed contract pending backend implementation; all authorization remains server-side.
export const careApi = {
  inviteDoctor(physicianEmail) { return authRequest('/api/care/patient/invitations', { physicianEmail }); },
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
