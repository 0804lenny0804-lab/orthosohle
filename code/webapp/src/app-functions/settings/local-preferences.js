const STORAGE_PREFIX = 'orthosohle:display-preferences:v1:';
const DEFAULTS = Object.freeze({ contrast: 'standard', textSize: 'standard' });
const CONTRASTS = new Set(['standard', 'high']);
const TEXT_SIZES = new Set(['standard', 'large']);
const inMemoryPreferences = new Map();
const memoryOverrides = new Set();

function storageKey(identityId) {
  if (typeof identityId !== 'string' || !identityId.trim()) return null;
  return `${STORAGE_PREFIX}${encodeURIComponent(identityId)}`;
}

function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULTS };
  return {
    contrast: CONTRASTS.has(value.contrast) ? value.contrast : DEFAULTS.contrast,
    textSize: TEXT_SIZES.has(value.textSize) ? value.textSize : DEFAULTS.textSize
  };
}

export function loadDisplayPreferences(storage, identityId) {
  const key = storageKey(identityId);
  if (!key) return { ...DEFAULTS };
  if (memoryOverrides.has(key)) return { ...inMemoryPreferences.get(key) };
  try {
    if (storage && typeof storage.getItem === 'function') {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const preferences = validate(JSON.parse(raw));
        inMemoryPreferences.set(key, preferences);
        return { ...preferences };
      }
    }
  } catch {
    // Retain the current app-session choice when browser storage is blocked.
  }
  return { ...(inMemoryPreferences.get(key) || DEFAULTS) };
}

export function saveDisplayPreferences(storage, identityId, preferences) {
  const key = storageKey(identityId);
  if (!key) return false;
  const validated = validate(preferences);
  inMemoryPreferences.set(key, validated);
  if (!storage || typeof storage.setItem !== 'function') {
    memoryOverrides.add(key);
    return false;
  }
  try {
    storage.setItem(key, JSON.stringify(validated));
    memoryOverrides.delete(key);
    return true;
  } catch {
    memoryOverrides.add(key);
    return false;
  }
}

export function displayPreferenceClasses(preferences) {
  const valid = validate(preferences);
  return {
    'display-contrast-high': valid.contrast === 'high',
    'display-text-large': valid.textSize === 'large'
  };
}

export function applyDisplayPreferenceClasses(classList, identityId, preferences) {
  classList.remove('display-contrast-high', 'display-text-large');
  if (!identityId) return;
  for (const [className, enabled] of Object.entries(displayPreferenceClasses(preferences))) {
    if (enabled) classList.add(className);
  }
}

export const defaultDisplayPreferences = () => ({ ...DEFAULTS });
