import { reactive } from 'vue';

export function draftForIdentity(identityId) {
  if (!identityId) return null;
  let draft = sessionDrafts.get(identityId);
  if (!draft) {
    draft = reactive({
      active: false, source: 'ble', ownerIdentityId: identityId, startedAt: '', lastReceiveAt: '',
      sessionId: '', aggregator: null, pendingPayload: null, skippedSamples: 0, uploading: false,
      error: '', notice: '',
    });
    sessionDrafts.set(identityId, draft);
  }
  return draft;
}

export function hasUnsavedMeasurementDraft() {
  return [...sessionDrafts.values()].some((draft) => draft.active || !!draft.pendingPayload);
}

export function hasUnsavedDraftForOtherIdentity(identityId) {
  return [...sessionDrafts.entries()].some(([ownerId, draft]) => ownerId !== identityId
    && (draft.active || !!draft.pendingPayload));
}

const sessionDrafts = new Map();
