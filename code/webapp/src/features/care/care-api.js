import { authRequest } from '../account/auth-api.js';

// Proposed contract pending backend implementation; all authorization remains server-side.
export const careApi = {
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
