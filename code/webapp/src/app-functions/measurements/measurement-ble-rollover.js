import { queuePendingBleSample } from './measurement-rules.js';

export function bufferBleRolloverSample(draft, { kg, sampleTime, identityId, epoch }) {
  const accepted = queuePendingBleSample(draft, {
    kg,
    timestamp: new Date(sampleTime).toISOString(),
    source: 'ble',
    identityId,
    epoch,
  });
  if (!accepted && draft.ownerIdentityId === identityId) {
    return `${draft.rolloverOverflowSamples} zusätzliche BLE-Werte konnten im begrenzten Arbeitsspeicherpuffer nicht behalten werden.`;
  }
  return '';
}

export function requestSessionFeedback(draft, sessionId, currentIdentityId, emit) {
  if (!draft || !sessionId || draft.lastFeedbackSessionId === sessionId) return;
  draft.feedbackRequestedSessionId = sessionId;
  deliverSessionFeedbackIfReady(draft, currentIdentityId, emit);
}

export function deliverSessionFeedbackIfReady(draft, currentIdentityId, emit) {
  const sessionId = draft?.feedbackRequestedSessionId;
  if (!sessionId || currentIdentityId !== draft.ownerIdentityId || draft.lastFeedbackSessionId === sessionId) return;
  draft.lastFeedbackSessionId = sessionId;
  draft.feedbackRequestedSessionId = '';
  emit({ sessionId, identityId: draft.ownerIdentityId });
}
