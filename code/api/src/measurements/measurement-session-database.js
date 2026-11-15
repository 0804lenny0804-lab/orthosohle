import { createHash } from 'node:crypto';

function fingerprint(value) {
  const canonical = {
    sessionId: value.sessionId,
    source: value.source,
    startedAt: new Date(value.startedAt).toISOString(),
    endedAt: new Date(value.endedAt).toISOString(),
    intervals: value.intervals.map(item => ({ timestamp: new Date(item.timestamp).toISOString(), count: item.count, avg: item.avg, max: item.max })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function createMeasurementSessionRepository(database) {
  const insertSession = database.prepare(`
    INSERT INTO measurement_session (id, patient_profile_id, source, started_at, ended_at, payload_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(id) DO NOTHING
  `);
  const findById = database.prepare('SELECT patient_profile_id AS profileId, payload_hash AS payloadHash FROM measurement_session WHERE id = ?');
  const insertInterval = database.prepare(`
    INSERT INTO measurement_interval (session_id, received_at, sample_count, average, maximum)
    VALUES (?, ?, ?, ?, ?)
  `);
  const findSession = database.prepare(`
    SELECT id, source, started_at AS startedAt, ended_at AS endedAt, payload_hash AS payloadHash
    FROM measurement_session WHERE id = ? AND patient_profile_id = ?
  `);
  const listIntervals = database.prepare(`
    SELECT received_at AS timestamp, sample_count AS count, average AS avg, maximum AS max
    FROM measurement_interval WHERE session_id = ? ORDER BY received_at
  `);
  const findIntervalSession = database.prepare('SELECT id FROM measurement_session WHERE id = ? AND patient_profile_id = ?');
  const listForProfilePage = database.prepare(`
    SELECT id, source, started_at AS startedAt, ended_at AS endedAt
    FROM measurement_session WHERE patient_profile_id = ?
      AND (? IS NULL OR started_at < ? OR (started_at = ? AND id < ?))
    ORDER BY started_at DESC, id DESC LIMIT ?
  `);

  const save = database.transaction((profileId, session) => {
    const hash = fingerprint(session);
    insertSession.run(session.sessionId, profileId, session.source, session.startedAt, session.endedAt, hash);
    const anyOwner = findById.get(session.sessionId);
    if (anyOwner?.profileId !== profileId) return { kind: 'conflict' };
    const existing = findSession.get(session.sessionId, profileId);
    if (!existing) return { kind: 'conflict' };
    if (existing.payloadHash !== hash) return { kind: 'conflict' };
    const storedIntervalCount = database.prepare('SELECT count(*) AS count FROM measurement_interval WHERE session_id = ?').get(session.sessionId).count;
    if (storedIntervalCount === session.intervals.length) {
      return { kind: 'existing', value: readSession(session.sessionId, profileId) };
    }
    for (const interval of session.intervals) insertInterval.run(session.sessionId, new Date(interval.timestamp).toISOString(), interval.count, interval.avg, interval.max);
    return { kind: 'created', value: readSession(session.sessionId, profileId) };
  });

  function readSession(id, profileId) {
    const row = findSession.get(id, profileId);
    if (!row) return null;
    const samples = listIntervals.all(id);
    const gaps = [];
    for (let index = 1; index < samples.length; index += 1) {
      const previous = Date.parse(samples[index - 1].timestamp);
      const current = Date.parse(samples[index].timestamp);
      if (current - previous > 1500) gaps.push({ from: samples[index - 1].timestamp, to: samples[index].timestamp });
    }
    return { id: row.id, source: row.source, startedAt: row.startedAt, endedAt: row.endedAt, samples, gaps };
  }

  function readSummary(row) {
    return { id: row.id, source: row.source, startedAt: row.startedAt, endedAt: row.endedAt };
  }

  return {
    saveForProfile(profileId, session) { return save(profileId, session); },
    listForProfile(profileId, before, limit) {
      const rows = listForProfilePage.all(profileId, before?.startedAt ?? null, before?.startedAt ?? null,
        before?.startedAt ?? null, before?.id ?? null, limit + 1);
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const last = hasMore ? page[page.length - 1] : null;
      return { sessions: page.map(readSummary), nextBefore: last ? { startedAt: last.startedAt, id: last.id } : null };
    },
    findForProfile(profileId, id) {
      if (!findIntervalSession.get(id, profileId)) return null;
      return readSession(id, profileId);
    },
  };
}
