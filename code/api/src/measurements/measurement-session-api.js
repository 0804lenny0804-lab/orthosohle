import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { createMeasurementSessionRepository } from './measurement-session-database.js';

const MAX_INTERVALS = 3600;
const MAX_CHECKPOINT_INTERVALS = 60;
const MAX_VALUE = 1000000;
import { validTime, pagination } from './session-pagination.js';

function validSession(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return false;
  if (Object.keys(body).sort().join(',') !== 'endedAt,intervals,sessionId,source,startedAt') return false;
  if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) return false;
  if (!['ble', 'simulation'].includes(body.source) || !validTime(body.startedAt) || !validTime(body.endedAt)) return false;
  const started = Date.parse(body.startedAt), ended = Date.parse(body.endedAt);
    if (ended <= started || ended - started > MAX_INTERVALS * 1000) return false;
  if (!Array.isArray(body.intervals) || body.intervals.length < 1 || body.intervals.length > MAX_INTERVALS) return false;
  let previous = -Infinity;
  for (const item of body.intervals) {
    if (!item || Array.isArray(item) || typeof item !== 'object' || Object.keys(item).sort().join(',') !== 'avg,count,max,timestamp') return false;
    const time = Date.parse(item.timestamp);
    if (!validTime(item.timestamp) || time <= previous) return false;
    if (new Date(time).toISOString() !== new Date(time).toISOString().slice(0, 19) + '.000Z') return false;
    const firstBucket = Math.floor(started / 1000) * 1000;
    const lastBucket = Math.floor(ended / 1000) * 1000;
    if (time < firstBucket || time > lastBucket) return false;
    if (!Number.isInteger(item.count) || item.count < 1 || item.count > 100000) return false;
    if (![item.avg, item.max].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_VALUE)) return false;
    if (item.max < item.avg) return false;
    previous = time;
  }
  return true;
}

function normalizedSession(body) {
  return {
    ...body,
    startedAt: new Date(body.startedAt).toISOString(),
    endedAt: new Date(body.endedAt).toISOString(),
    intervals: body.intervals.map(item => ({ ...item, timestamp: new Date(item.timestamp).toISOString() })),
  };
}

function validCheckpoint(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return false;
  if (Object.keys(body).sort().join(',') !== 'checkpointAt,completed,intervals,sequence,sessionId,source,startedAt') return false;
  if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) return false;
  if (!['ble', 'simulation'].includes(body.source) || !validTime(body.startedAt) || !validTime(body.checkpointAt)) return false;
  if (!Number.isInteger(body.sequence) || body.sequence < 1 || body.sequence > MAX_INTERVALS + 1 || typeof body.completed !== 'boolean') return false;
  const started = Date.parse(body.startedAt), checkpointAt = Date.parse(body.checkpointAt);
  if (checkpointAt <= started || checkpointAt - started > MAX_INTERVALS * 1000) return false;
  if (!Array.isArray(body.intervals) || body.intervals.length > MAX_CHECKPOINT_INTERVALS) return false;
  if ((!body.completed || body.sequence === 1) && body.intervals.length < 1) return false;
  if (body.sequence === MAX_INTERVALS + 1 && (!body.completed || body.intervals.length !== 0)) return false;
  let previous = -Infinity;
  const firstBucket = Math.floor(started / 1000) * 1000;
  const lastBucket = Math.floor(checkpointAt / 1000) * 1000;
  for (const item of body.intervals) {
    if (!item || Array.isArray(item) || typeof item !== 'object' || Object.keys(item).sort().join(',') !== 'avg,count,max,timestamp') return false;
    const time = Date.parse(item.timestamp);
    if (!validTime(item.timestamp) || new Date(time).toISOString() !== new Date(time).toISOString().slice(0, 19) + '.000Z') return false;
    if (time <= previous || time < firstBucket || time > lastBucket) return false;
    if (!Number.isInteger(item.count) || item.count < 1 || item.count > 100000) return false;
    if (![item.avg, item.max].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_VALUE)) return false;
    if (item.max < item.avg) return false;
    previous = time;
  }
  return true;
}

function normalizedCheckpoint(body) {
  return {
    ...body,
    startedAt: new Date(body.startedAt).toISOString(),
    checkpointAt: new Date(body.checkpointAt).toISOString(),
    intervals: body.intervals.map(item => ({ ...item, timestamp: new Date(item.timestamp).toISOString() })),
  };
}

function historyQuery(query) {
  const allowed = new Set(['from', 'to', 'bucketSeconds', 'limit', 'afterTime', 'afterSessionId']);
  if (Object.keys(query).some(key => !allowed.has(key)) || !validTime(query.from) || !validTime(query.to)) return null;
  const from = Date.parse(query.from), to = Date.parse(query.to), duration = to - from;
  const bucketSeconds = Number(query.bucketSeconds), limit = Number(query.limit ?? '500');
  if (from < 0 || duration <= 0 || duration > 32 * 86400000 || !['60', '900', '3600'].includes(query.bucketSeconds)
      || (duration >= 3 * 86400000 && bucketSeconds < 900) || (duration > 7 * 86400000 && bucketSeconds < 3600)
      || !/^[0-9]{1,3}$/.test(String(query.limit ?? '500')) || limit < 1 || limit > 500) return null;
  const hasTime = query.afterTime !== undefined, hasSession = query.afterSessionId !== undefined;
  if (hasTime !== hasSession) return null;
  let after = null;
  if (hasTime) {
    if (!validTime(query.afterTime) || typeof query.afterSessionId !== 'string'
        || !/^[0-9a-f-]{36}$/i.test(query.afterSessionId)) return null;
    const time = Date.parse(query.afterTime);
    if (time % (bucketSeconds * 1000) !== 0 || time < Math.floor(from / (bucketSeconds * 1000)) * bucketSeconds * 1000 || time >= to) return null;
    after = { timestamp: new Date(time).toISOString(), sessionId: query.afterSessionId };
  }
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), bucketSeconds, limit, after };
}

export function createMeasurementSessionRouter(auth, database, webOrigin) {
  const router = express.Router();
  const sessions = createMeasurementSessionRepository(database);
  async function requestSession(req, res) {
    let session;
    try {
      session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    } catch {
      res.status(401).json({ error: 'authentication_required' });
      return null;
    }
    if (!session?.user?.id || !session?.session?.id || !session?.session?.token) {
      res.status(401).json({ error: 'authentication_required' });
      return null;
    }
    return session;
  }

  function withCurrentPatient(session, operation, { readOnly = false } = {}) {
    const transaction = database.transaction(() => {
      const current = database.prepare(`SELECT u.emailVerified AS emailVerified
        FROM session s JOIN user u ON u.id = s.userId
        WHERE s.id = ? AND s.userId = ? AND s.token = ? AND s.expiresAt > ?`)
        .get(session.session.id, session.user.id, session.session.token, new Date().toISOString());
      if (!current) return { kind: 'authentication_required' };
      if (current.emailVerified !== 1) return { kind: 'email_verification_required' };
      const profile = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(session.user.id);
      if (!profile) return { kind: 'patient_profile_required' };
      return { kind: 'ok', value: operation(profile.id) };
    });
    return readOnly ? transaction.deferred() : transaction.immediate();
  }

  function sendAccessError(res, kind) {
    if (kind === 'authentication_required') return res.status(401).json({ error: kind });
    if (kind === 'email_verification_required') return res.status(403).json({ error: kind });
    if (kind === 'patient_profile_required') return res.status(403).json({ error: kind });
    return null;
  }

  router.use((req, res, next) => {
    if (req.method === 'POST' && req.get('Origin') !== webOrigin) return res.status(403).json({ error: 'origin_not_allowed' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'json_required' });
    if (req.method === 'POST') return express.json({ limit: '1mb', strict: true })(req, res, next);
    return next();
  });
  router.get('/', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    const profile = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(session.user.id);
    if (!profile) return res.status(403).json({ error: 'patient_profile_required' });
    const page = pagination(req.query);
    if (!page) return res.status(400).json({ error: 'invalid_pagination' });
    return res.json(sessions.listForProfile(profile.id, page.before, page.limit));
  });
  router.get('/history', async (req, res) => {
    const session = await requestSession(req, res);
    if (!session) return;
    const query = historyQuery(req.query);
    if (!query) return res.status(400).json({ error: 'invalid_history_query' });
    const result = withCurrentPatient(session, profileId => sessions.historyForProfile(profileId, query), { readOnly: true });
    if (sendAccessError(res, result.kind)) return;
    return res.json(result.value);
  });
  router.get('/active', async (req, res) => {
    const session = await requestSession(req, res);
    if (!session) return;
    const result = withCurrentPatient(session, profileId => sessions.listActiveForProfile(profileId));
    if (sendAccessError(res, result.kind)) return;
    return res.json({ sessions: result.value });
  });
  router.post('/checkpoints', async (req, res) => {
    const session = await requestSession(req, res);
    if (!session) return;
    if (!validCheckpoint(req.body)) return res.status(400).json({ error: 'invalid_checkpoint' });
    const access = withCurrentPatient(session, profileId =>
      sessions.saveCheckpointForProfile(profileId, normalizedCheckpoint(req.body)));
    if (sendAccessError(res, access.kind)) return;
    const result = access.value;
    if (result.kind === 'active_session_exists') return res.status(409).json({ error: 'active_measurement_session_exists' });
    if (result.kind === 'conflict') return res.status(409).json({ error: 'checkpoint_conflict' });
    if (result.kind === 'invalid') return res.status(400).json({ error: 'checkpoint_limit_exceeded' });
    return res.status(result.kind === 'created' ? 201 : 200).json({ session: result.value });
  });
  router.post('/', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    const profile = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(session.user.id);
    if (!profile) return res.status(403).json({ error: 'patient_profile_required' });
    if (!validSession(req.body)) return res.status(400).json({ error: 'invalid_session' });
    const result = sessions.saveForProfile(profile.id, normalizedSession(req.body));
    if (result.kind === 'conflict') return res.status(409).json({ error: 'session_id_conflict' });
    return res.status(result.kind === 'created' ? 201 : 200).json({ session: result.value });
  });
  router.get('/:id', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    if (!session.user.emailVerified) return res.status(403).json({ error: 'email_verification_required' });
    const profile = database.prepare('SELECT id FROM patient_profile WHERE account_user_id = ?').get(session.user.id);
    if (!profile) return res.status(403).json({ error: 'patient_profile_required' });
    const entry = sessions.findForProfile(profile.id, req.params.id);
    if (!entry) return res.status(404).json({ error: 'session_not_found' });
    return res.json({ session: entry });
  });
  return router;
}
