import { reactive } from 'vue';

export function draftForIdentity(identityId) {
  if (!identityId) return null;
  let draft = sessionDrafts.get(identityId);
  if (!draft) {
    draft = reactive({
      active: false, source: 'ble', ownerIdentityId: identityId, startedAt: '', lastReceiveAt: '',
      sessionId: '', aggregator: null, pendingPayload: null, skippedSamples: 0, uploading: false,
      checkpointQueue: [], checkpointSequence: 0, checkpointedIntervalCount: 0,
      finalizing: false, recoveryChecked: false, recoveryBlocked: false, error: '', notice: '',
      rolloverSamples: [], rolloverOverflowSamples: 0, rolloverPending: false,
      bleEpoch: 0, lastCompletedBleEpoch: 0, lastCompletedBleSessionId: '',
      disconnectedBleEpochs: [], lastFeedbackSessionId: '', feedbackRequestedSessionId: '',
    });
    sessionDrafts.set(identityId, draft);
  }
  return draft;
}

export function hasUnsavedMeasurementDraft() {
  return [...sessionDrafts.values()].some((draft) => draft.active || draft.finalizing || !!draft.pendingPayload
    || draft.checkpointQueue.length > 0 || draft.rolloverSamples.length > 0);
}

export function hasUnsavedDraftForOtherIdentity(identityId) {
  return [...sessionDrafts.entries()].some(([ownerId, draft]) => ownerId !== identityId
    && (draft.active || draft.finalizing || !!draft.pendingPayload || draft.checkpointQueue.length > 0
      || draft.rolloverSamples.length > 0));
}

const sessionDrafts = new Map();
