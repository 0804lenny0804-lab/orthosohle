// Old prototype values used a fixed user ID or one shared run key. None of
// these entries represented server-owned or account-owned data.
export const legacyDemoStorageKeys = [
  'pwa__limit_user_1',
  'pwa__limit_user_1_pending',
  'pwa__stepGoal_user_1',
  'pwa__stepGoal_user_1_pending',
  'orthosohle_current_run',
];

export function createDemoSessionState() {
  return {
    rawValues: [],
    measurements: [],
    limitHistory: [],
    stepCount: 0,
    stepGoal: 20,
    currentLimit: null,
  };
}

export function clearLegacyDemoStorage(storage) {
  for (const key of legacyDemoStorageKeys) storage.removeItem(key);
}
