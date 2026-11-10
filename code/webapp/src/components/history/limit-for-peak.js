export function limitForPeak(limits, timestamp) {
  const peakTime = Date.parse(timestamp);
  if (!Number.isFinite(peakTime)) return null;

  let effectiveLimit = null;
  for (const item of limits) {
    const limitTime = Date.parse(item.timestamp);
    const value = Number(item.limit_value);
    if (!Number.isFinite(limitTime) || limitTime > peakTime) break;
    if (Number.isFinite(value) && value > 0) effectiveLimit = value;
  }
  return effectiveLimit;
}
