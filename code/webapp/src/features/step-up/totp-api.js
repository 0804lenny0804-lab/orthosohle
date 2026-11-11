import { authRequest } from '../account/auth-api.js';

export const totpStepUpApi = {
  verify(code) {
    return authRequest('/api/step-up/verify', { code });
  },
  check() {
    return authRequest('/api/step-up/guard', {});
  },
};
