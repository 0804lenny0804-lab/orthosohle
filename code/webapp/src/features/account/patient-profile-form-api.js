import { authRequest } from './auth-api.js';

function path(role, patientId) {
  if (role === 'physician') return `/api/patient-profile/physician/${encodeURIComponent(patientId)}`;
  return '/api/patient-profile';
}

export const patientProfileFormApi = {
  get(role, patientId = '') { return authRequest(path(role, patientId)); },
  patch(role, patientId, payload) { return authRequest(path(role, patientId), payload, { method: 'PATCH' }); },
};

export function parseEditableProfile(result) {
  const profile = result?.profile;
  if (profile === null) return null;
  if (!profile || typeof profile.id !== 'string' || !Number.isInteger(profile.version) || profile.version < 0
    || (profile.injury !== null && typeof profile.injury !== 'string')
    || (profile.weightKg !== null && (typeof profile.weightKg !== 'number' || !Number.isFinite(profile.weightKg)))
    || (profile.lastChangedBy !== undefined && profile.lastChangedBy !== null
      && (typeof profile.lastChangedBy !== 'object' || typeof profile.lastChangedBy.name !== 'string'))) {
    throw new Error('Der Kontoserver hat ein ungültiges Patientenprofil zurückgegeben.');
  }
  return profile;
}
