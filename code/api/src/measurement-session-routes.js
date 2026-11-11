import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { createMeasurementSessionRepository } from './measurement-session-repository.js';

const MAX_INTERVALS = 3600;
const MAX_VALUE = 1000000;
const utc = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;

function validTime(value) {
  if (typeof value !== 'string' || !utc.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const canonical = new Date(Date.parse(value)).toISOString();
  return value === canonical || value === canonical.replace('.000Z', 'Z');
}

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

export function createMeasurementSessionRouter(auth, database, webOrigin) {
  const router = express.Router();
  const sessions = createMeasurementSessionRepository(database);
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
    const limitText = req.query.limit ?? '50';
    let before = null;
    if (req.query.before !== undefined) {
      try { before = JSON.parse(req.query.before); } catch { return res.status(400).json({ error: 'invalid_pagination' }); }
    }
    const limit = Number(limitText);
    if (!/^\d{1,2}$/.test(String(limitText)) || !Number.isInteger(limit) || limit < 1 || limit > 50 ||
      (before !== null && (!before || typeof before !== 'object' || Array.isArray(before) ||
        Object.keys(before).sort().join(',') !== 'id,startedAt' || !validTime(before.startedAt) || !/^[0-9a-f-]{36}$/i.test(before.id)))) {
      return res.status(400).json({ error: 'invalid_pagination' });
    }
    if (before) before.startedAt = new Date(before.startedAt).toISOString();
    return res.json(sessions.listForProfile(profile.id, before, limit));
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
