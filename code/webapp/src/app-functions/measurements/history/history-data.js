import { authRequest } from '../../account/account-api.js';

export function historyWindow(days, now = new Date()) {
  const end = new Date(now);
  const start = new Date(end);
  if (days === 0) start.setHours(0, 0, 0, 0);
  else start.setTime(end.getTime() - days * 86400000);
  return { from: start.toISOString(), to: end.toISOString(), bucketSeconds: days >= 7 ? 3600 : days >= 3 ? 900 : 60 };
}

export function parseHistoryPage(result) {
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (!result || !Array.isArray(result.samples) || result.samples.some(item =>
    !item || typeof item.sessionId !== 'string' || !item.sessionId || !['ble', 'simulation'].includes(item.source)
    || !date(item.timestamp) || !date(item.firstAt) || !date(item.lastAt) || Date.parse(item.firstAt) > Date.parse(item.lastAt)
    || !Number.isSafeInteger(item.count) || item.count < 1 || !Number.isSafeInteger(item.intervalCount) || item.intervalCount < 1
    || !Number.isSafeInteger(item.missingSeconds) || item.missingSeconds < 0
    || !Number.isFinite(item.avg) || item.avg < 0 || !Number.isFinite(item.max) || item.max < item.avg)
    || (result.nextAfter !== null && (!result.nextAfter || !date(result.nextAfter.timestamp)
      || typeof result.nextAfter.sessionId !== 'string' || !result.nextAfter.sessionId))) {
    throw new Error('Der Server hat ungültige Verlaufsdaten zurückgegeben.');
  }
  return result;
}

export async function loadHistory(window, isCurrent = () => true, request = authRequest) {
  const samples = [];
  let cursor = null;
  let previous = null;
  const compare = (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
    || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0);
  do {
    const query = new URLSearchParams({ ...window, bucketSeconds: String(window.bucketSeconds), limit: '500' });
    if (cursor) { query.set('afterTime', cursor.timestamp); query.set('afterSessionId', cursor.sessionId); }
    const page = parseHistoryPage(await request(`/api/measurement-sessions/history?${query}`));
    if (!isCurrent()) return null;
    for (const sample of page.samples) {
      if (previous && compare(previous, sample) >= 0) throw new Error('Der Verlauf konnte nicht vollständig geladen werden.');
      previous = sample;
    }
    cursor = page.nextAfter;
    if (cursor && (!previous || !page.samples.length || compare(previous, cursor) !== 0)) {
      throw new Error('Der Verlauf konnte nicht vollständig geladen werden.');
    }
    samples.push(...page.samples);
    if (samples.length >= 10000 && cursor) return { samples, complete: false };
  } while (cursor);
  return { samples, complete: true };
}
