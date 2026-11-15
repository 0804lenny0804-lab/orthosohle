export const MAX_SESSION_INTERVALS = 3600;
export const MAX_SESSION_DURATION_MS = 60 * 60 * 1000;
export const MAX_SESSION_VALUE = 1_000_000;
export const MAX_SAMPLES_PER_INTERVAL = 100_000;

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

export function createSecondAggregator() {
  const bySecond = new Map();
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
