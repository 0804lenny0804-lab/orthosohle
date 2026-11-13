import { authRequest } from '../account/auth-api.js';
import { parseSessionsResponse } from '../measurement/session-api.js';

function patientSessionsPath(patientId) {
  return `/api/care/physician/patients/${encodeURIComponent(patientId)}/measurement-sessions`;
}

export function isPhysicianSessionAccessError(error) {
  return [401, 403, 404].includes(error?.status);
}

export async function fetchPhysicianMeasurementSessions(patientId, { before = null } = {}) {
  const query = new URLSearchParams({ limit: '50' });
  if (before) query.set('before', JSON.stringify(before));
  const result = await authRequest(`${patientSessionsPath(patientId)}?${query}`);
  const sessions = parseSessionsResponse(result);
  return { sessions, nextBefore: result.nextBefore || null };
}

export async function fetchPhysicianMeasurementSession(patientId, sessionId) {
  const result = await authRequest(`${patientSessionsPath(patientId)}/${encodeURIComponent(sessionId)}`);
  const [session] = parseSessionsResponse({ sessions: [result?.session ?? result] });
  if (!Array.isArray(session.samples) || !Array.isArray(session.gaps)) {
    throw new Error('Der Kontoserver hat keine vollständigen Sitzungsdetails zurückgegeben.');
  }
  return session;
}
