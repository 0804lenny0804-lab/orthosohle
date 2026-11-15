<template>
  <section v-if="identityId" class="card mx-auto mt-4" aria-labelledby="display-settings-title" style="max-width: 38rem">
    <div class="card-body">
      <h2 id="display-settings-title" class="h4">Darstellung</h2>
      <p class="small text-muted">Diese Auswahl wird nur lokal auf diesem Gerät für dein Konto gespeichert. Sie wird nicht synchronisiert.</p>
      <div class="mb-3">
        <label for="display-contrast" class="form-label">Kontrast</label>
        <select id="display-contrast" class="form-select" :value="preferences.contrast" @change="update('contrast', $event.target.value)">
          <option value="standard">Standard</option>
          <option value="high">Erhöht</option>
        </select>
      </div>
      <div>
        <label for="display-text-size" class="form-label">Schriftgröße</label>
        <select id="display-text-size" class="form-select" :value="preferences.textSize" @change="update('textSize', $event.target.value)">
          <option value="standard">Standard</option>
          <option value="large">Groß</option>
        </select>
      </div>
      <p v-if="saveError" class="small text-warning-emphasis mt-3 mb-0" role="status">Speichern im Browserspeicher nicht möglich; die Auswahl gilt bis zum Verlassen der App.</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { defaultDisplayPreferences, loadDisplayPreferences, saveDisplayPreferences } from './local-preferences.js';

const props = defineProps({ identityId: { type: String, default: '' } });
const preferences = ref(defaultDisplayPreferences());
const saveError = ref(false);
let stopIdentityWatch;

function notifyOwner(value) {
  window.dispatchEvent(new CustomEvent('display-preferences-changed', { detail: {
    identityId: props.identityId,
    preferences: value
  } }));
}

function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadForCurrentIdentity() {
  preferences.value = loadDisplayPreferences(getLocalStorage(), props.identityId);
  saveError.value = false;
  notifyOwner(preferences.value);
}

function update(field, value) {
  const next = { ...preferences.value, [field]: value };
  preferences.value = next;
  const saved = saveDisplayPreferences(getLocalStorage(), props.identityId, next);
  saveError.value = !saved;
  notifyOwner(next);
}

onMounted(() => {
  loadForCurrentIdentity();
  stopIdentityWatch = watch(() => props.identityId, loadForCurrentIdentity);
});

</script>
