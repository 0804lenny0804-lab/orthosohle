import { authRequest } from '../account/auth-api.js';

// The approval token never enters this client's URL, storage, or response handling beyond memory.
export const physicianApprovalApi = {
  verifyTotp(code) {
    return authRequest('/api/step-up/verify', { code });
  },
  reviewerStatus() {
    return authRequest('/api/physician-review/approval');
  },
  inspect(token) {
    return authRequest('/api/physician-review/approval/inspect', { token });
  },
  approve(token) {
    return authRequest('/api/physician-review/approval/approve', { token });
  },
};
