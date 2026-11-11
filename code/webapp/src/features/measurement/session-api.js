import { authRequest, AuthRequestError } from '../account/auth-api.js';
import { MAX_SESSION_VALUE, MAX_SAMPLES_PER_INTERVAL } from './measurement-sessions.js';

function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validInterval(value) {
  return value && isIsoDate(value.timestamp)
    && Number.isInteger(value.count) && value.count > 0
    && value.count <= MAX_SAMPLES_PER_INTERVAL
    && Number.isFinite(value.avg) && value.avg >= 0 && value.avg <= MAX_SESSION_VALUE
    && Number.isFinite(value.max) && value.max >= value.avg && value.max <= MAX_SESSION_VALUE;
}

export function parseSessionsResponse(result) {
  if (!result || !Array.isArray(result.sessions)
    || (result.nextBefore !== null && result.nextBefore !== undefined
      && (!result.nextBefore || typeof result.nextBefore.id !== 'string' || !result.nextBefore.id
        || !isIsoDate(result.nextBefore.startedAt)))) {
    throw new Error('Der Kontoserver hat einen ungültigen Sitzungsverlauf zurückgegeben.');
  }
  return result.sessions.map((session) => {
    const start = Date.parse(session?.startedAt);
    const end = Date.parse(session?.endedAt);
    const samples = session?.samples;
    const gaps = session?.gaps;
    const orderedSamples = Array.isArray(samples) && samples.every((sample, index) =>
      validInterval(sample)
      && new Date(Date.parse(sample.timestamp)).toISOString().endsWith('.000Z')
      && (index === 0 || Date.parse(samples[index - 1].timestamp) < Date.parse(sample.timestamp))
      && Date.parse(sample.timestamp) >= Math.floor(start / 1000) * 1000
      && Date.parse(sample.timestamp) <= Math.floor(end / 1000) * 1000);
    if (!session || typeof session.id !== 'string' || !session.id
      || !['ble', 'simulation'].includes(session.source)
      || !isIsoDate(session.startedAt) || !isIsoDate(session.endedAt) || end <= start
      || ('samples' in session && !orderedSamples)
      || ('gaps' in session && (!Array.isArray(gaps)
        || !gaps.every((gap) => gap && isIsoDate(gap.from) && isIsoDate(gap.to) && Date.parse(gap.from) <= Date.parse(gap.to))))) {
      throw new Error('Der Kontoserver hat eine ungültige Sitzung zurückgegeben.');
    }
    return session;
  });
}

export async function fetchMeasurementSessions({ before = '' } = {}) {
  const query = new URLSearchParams({ limit: '50' });
  if (before) query.set('before', JSON.stringify(before));
  const result = await authRequest(`/api/measurement-sessions?${query}`);
  const sessions = parseSessionsResponse(result);
  return { sessions, nextBefore: result.nextBefore || null };
}

export async function fetchMeasurementSession(id) {
  const result = await authRequest(`/api/measurement-sessions/${encodeURIComponent(id)}`);
  const [session] = parseSessionsResponse({ sessions: [result?.session] });
  if (!Array.isArray(session.samples) || !Array.isArray(session.gaps)) {
    throw new Error('Der Kontoserver hat keine vollständigen Sitzungsdetails zurückgegeben.');
  }
  return session;
}

export async function uploadMeasurementSession(payload) {
  try {
    await authRequest('/api/measurement-sessions', payload);
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 409) {
      throw new Error('Diese Sitzungs-ID ist bereits mit anderen Daten gespeichert. Bitte den Kontosupport kontaktieren; die lokalen Werte bleiben bis dahin erhalten.');
    }
    throw error;
  }
}
