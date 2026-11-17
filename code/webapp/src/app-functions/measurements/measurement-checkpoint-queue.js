import { MAX_SESSION_DURATION_MS } from './measurement-rules.js';

export function enqueueMeasurementCheckpoints(current, intervals, completed = false) {
  if (!current?.sessionId || !current.startedAt || current.finalizing && !completed) return;
  const alreadyScheduled = current.checkpointedIntervalCount
    + current.checkpointQueue.reduce((total, chunk) => total + chunk.intervals.length, 0);
  const remaining = intervals.slice(alreadyScheduled);
  for (let offset = 0; offset < remaining.length; offset += 60) {
    const chunkIntervals = remaining.slice(offset, offset + 60);
    current.checkpointQueue.push({
      sessionId: current.sessionId,
      source: current.source,
      startedAt: current.startedAt,
      sequence: current.checkpointSequence + current.checkpointQueue.length + 1,
      checkpointAt: checkpointTime(current.startedAt, chunkIntervals),
      intervals: chunkIntervals,
      completed: false,
      bleEpoch: current.source === 'ble' ? current.bleEpoch : 0,
    });
  }
  if (completed) {
    current.checkpointQueue.push({
      sessionId: current.sessionId,
      source: current.source,
      startedAt: current.startedAt,
      sequence: current.checkpointSequence + current.checkpointQueue.length + 1,
      checkpointAt: checkpointTime(current.startedAt, []),
      intervals: [],
      completed: true,
      bleEpoch: current.source === 'ble' ? current.bleEpoch : 0,
    });
  }
}

export function enqueueClosedMeasurementCheckpoints(current, now = Date.now()) {
  const currentSecond = Math.floor(now / 1000) * 1000;
  const closed = current.aggregator.toIntervals().filter((interval) => Date.parse(interval.timestamp) < currentSecond);
  enqueueMeasurementCheckpoints(current, closed);
}

function checkpointTime(startedAt, intervals) {
  const start = Date.parse(startedAt);
  const lastBucketEnd = intervals.reduce((latest, interval) => Math.max(latest, Date.parse(interval.timestamp) + 1000), start + 1);
  const checkpoint = Math.max(start + 1, Math.min(Date.now(), start + MAX_SESSION_DURATION_MS), lastBucketEnd);
  return new Date(Math.min(checkpoint, start + MAX_SESSION_DURATION_MS)).toISOString();
}

export async function drainMeasurementCheckpointQueue(current, { currentIdentityId, upload, onAcknowledged }) {
  if (!current?.checkpointQueue.length || current.uploading) return { sent: 0, pending: current?.checkpointQueue.length || 0 };
  current.uploading = true;
  current.error = '';
  let sent = 0;
  try {
    while (current.checkpointQueue.length) {
      if (currentIdentityId() !== current.ownerIdentityId) {
        current.error = 'Für die Übertragung muss wieder genau das Konto angemeldet sein, zu dem diese Sitzung gehört. Die ausstehenden Werte bleiben im Arbeitsspeicher.';
        break;
      }
      const chunk = current.checkpointQueue[0];
      try {
        await upload(chunk);
      } catch (error) {
        current.error = `${error.message || 'Der Checkpoint konnte nicht bestätigt werden.'} Die ausstehenden Werte bleiben im Arbeitsspeicher; bitte Verbindung prüfen und erneut versuchen.`;
        break;
      }
      if (current.checkpointQueue[0] !== chunk) {
        current.error = 'Die Reihenfolge der wartenden Checkpoints hat sich unerwartet geändert. Die Sitzung bleibt im Arbeitsspeicher erhalten.';
        break;
      }
      current.checkpointQueue.shift();
      current.checkpointSequence = chunk.sequence;
      current.checkpointedIntervalCount += chunk.intervals.length;
      if (chunk.completed) {
        current.aggregator = null;
        current.sessionId = '';
        current.startedAt = '';
        current.finalizing = false;
      }
      sent += 1;
      onAcknowledged(chunk);
    }
  } finally {
    current.uploading = false;
  }
  return { sent, pending: current.checkpointQueue.length };
}
