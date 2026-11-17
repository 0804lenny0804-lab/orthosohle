export const MAX_SESSION_INTERVALS = 3600;
export const MAX_SESSION_DURATION_MS = 60 * 60 * 1000;
export const MAX_SESSION_VALUE = 1_000_000;
export const MAX_SAMPLES_PER_INTERVAL = 100_000;
// Bounds in-memory rollover buffering while a finalized segment waits for its server ACK.
export const MAX_PENDING_BLE_SAMPLES = 6_000;

export function queuePendingBleSample(draft, sample, limit = MAX_PENDING_BLE_SAMPLES) {
  if (!draft || sample?.source !== 'ble' || sample.identityId !== draft.ownerIdentityId
    || !Number.isInteger(sample.epoch) || sample.epoch < 1) return false;
  if (draft.rolloverSamples.length >= limit) {
    draft.rolloverOverflowSamples += 1;
    return false;
  }
  draft.rolloverSamples.push(sample);
  return true;
}

export function consumePendingBleSamples(draft, identityId, epoch) {
  if (!draft || identityId !== draft.ownerIdentityId) return { consumed: 0, blocked: 'identity' };
  let consumed = 0;
  while (draft.rolloverSamples.length) {
    const sample = draft.rolloverSamples[0];
    if (sample.identityId !== identityId || sample.source !== 'ble') return { consumed, blocked: 'identity' };
    if (sample.epoch !== epoch) return { consumed, nextEpoch: sample.epoch };
    const sampleTime = Date.parse(sample.timestamp);
    if (isAtSessionLimit(draft.startedAt, sampleTime, draft.aggregator.intervalCount)) {
      return { consumed, reachedLimit: true };
    }
    if (!draft.aggregator.add(sample.kg, sample.timestamp)) return { consumed, reachedLimit: true, reason: 'aggregate' };
    draft.rolloverSamples.shift();
    draft.lastReceiveAt = new Date(sampleTime).toISOString();
    consumed += 1;
    if (draft.aggregator.intervalCount >= MAX_SESSION_INTERVALS) return { consumed, reachedLimit: true };
  }
  return { consumed, drained: true };
}

export function completeBleCheckpointSegment(draft, sessionId, epoch) {
  draft.lastCompletedBleSessionId = sessionId;
  draft.lastCompletedBleEpoch = epoch;
  const sameEpochPending = draft.rolloverSamples.some((sample) => sample.epoch === epoch);
  const requested = draft.feedbackRequestedSessionId === sessionId;
  const disconnected = draft.disconnectedBleEpochs.includes(epoch);
  if (!sameEpochPending && (disconnected || requested)) {
    draft.disconnectedBleEpochs = draft.disconnectedBleEpochs.filter((value) => value !== epoch);
    if (requested) draft.feedbackRequestedSessionId = '';
    return { feedbackSessionId: sessionId, continueRollover: draft.rolloverSamples.length > 0 };
  }
  return { feedbackSessionId: '', continueRollover: draft.rolloverSamples.length > 0 };
}

export function canAutoStartBleSession({ source, connected, profileReady, ownerIdentityId, identityId, active, pending }) {
  return source === 'ble' && connected === true && profileReady === true
    && typeof identityId === 'string' && identityId.length > 0 && ownerIdentityId === identityId
    && active !== true && pending !== true;
}

export function isAtSessionLimit(startedAt, sampleTime, intervalCount) {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(sampleTime) || !Number.isInteger(intervalCount) || intervalCount < 0) return true;
  return sampleTime - start >= MAX_SESSION_DURATION_MS || intervalCount >= MAX_SESSION_INTERVALS;
}

export function getSessionEndTime(startedAt, currentTime, intervals) {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(currentTime) || !Array.isArray(intervals) || !intervals.length) {
    throw new Error('Eine beendete Messsitzung benötigt gültige Zeiten und mindestens ein Intervall.');
  }
  const lastInterval = Math.max(...intervals.map((interval) => Date.parse(interval.timestamp)));
  if (!Number.isFinite(lastInterval)) throw new Error('Die Messsitzung enthält eine ungültige Empfangszeit.');
  const end = Math.max(start + 1, Math.min(currentTime, start + MAX_SESSION_DURATION_MS), lastInterval);
  return new Date(end).toISOString();
}

export function createSecondAggregator(initialIntervals = []) {
  const bySecond = new Map();
  for (const interval of initialIntervals) {
    const timestamp = Date.parse(interval.timestamp);
    if (!Number.isFinite(timestamp) || !Number.isInteger(interval.count) || interval.count < 1
      || !Number.isFinite(interval.avg) || !Number.isFinite(interval.max)) continue;
    bySecond.set(timestamp, {
      timestamp: new Date(timestamp).toISOString(), count: interval.count,
      sum: interval.avg * interval.count, max: interval.max,
    });
  }
  return {
    add(kg, receivedAt) {
      const value = Number(kg);
      const timestamp = new Date(receivedAt).getTime();
      if (!Number.isFinite(value) || value < 0 || value > MAX_SESSION_VALUE || !Number.isFinite(timestamp)) return false;
      const second = Math.floor(timestamp / 1000) * 1000;
      let interval = bySecond.get(second);
      if (!interval) {
        if (bySecond.size >= MAX_SESSION_INTERVALS) return false;
        interval = { timestamp: new Date(second).toISOString(), count: 0, sum: 0, max: -Infinity };
        bySecond.set(second, interval);
      }
      if (interval.count >= MAX_SAMPLES_PER_INTERVAL) return false;
      interval.count += 1;
      interval.sum += value;
      interval.max = Math.max(interval.max, value);
      return true;
    },
    get intervalCount() { return bySecond.size; },
    toIntervals() {
      return [...bySecond.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
        .map(({ timestamp, count, sum, max }) => ({ timestamp, count, avg: sum / count, max }));
    },
  };
}

export function findReceiveGaps(intervals) {
  const ordered = [...intervals].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const gaps = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = Date.parse(ordered[index - 1].timestamp);
    const current = Date.parse(ordered[index].timestamp);
    if (current - previous > 1000) gaps.push({ from: new Date(previous + 1000).toISOString(), to: new Date(current).toISOString() });
  }
  return gaps;
}
