<template>
  <section class="patient-profile card mb-4" aria-labelledby="patient-profile-title">
    <div class="card-body">
      <h3 id="patient-profile-title" class="h5">Dein Patientenbereich</h3>
      <p class="small text-muted">
        Dein eigenes Patientenprofil wird deinem Konto zugeordnet und kann künftig Geräte und Messungen
        zuordnen. Durch die Einrichtung erhalten andere Personen keinen Zugriff.
      </p>

      <p v-if="status === 'loading'" role="status" aria-live="polite">Patientenprofil wird geladen …</p>
      <template v-else-if="status === 'missing'">
        <p id="patient-profile-missing" class="mb-2">Für dein Konto ist noch kein eigenes Patientenprofil eingerichtet.</p>
        <button type="button" class="btn btn-outline-primary" :disabled="busy" aria-describedby="patient-profile-missing" @click="createProfile">
          {{ busy ? 'Wird eingerichtet …' : 'Patientenprofil einrichten' }}
        </button>
      </template>
      <p v-else-if="status === 'ready'" role="status" aria-live="polite">
        Dein eigenes Patientenprofil ist eingerichtet und deinem Konto zugeordnet.
      </p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p class="mb-2">{{ errorMessage }}</p>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="loadProfile">
          Erneut versuchen
        </button>
      </div>
      <p v-if="notice" class="small text-success" role="status" aria-live="polite">{{ notice }}</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { authRequest } from './auth-api.js';

const props = defineProps({
  identityId: { type: String, required: true },
});

const status = ref('loading');
const busy = ref(false);
const errorMessage = ref('');
const notice = ref('');
let generation = 0;
let mounted = false;

function isCurrent(requestGeneration, identityId) {
  return mounted && requestGeneration === generation && identityId === props.identityId;
}

function resetForIdentity() {
  generation += 1;
  status.value = 'loading';
  busy.value = false;
  errorMessage.value = '';
  notice.value = '';
}

async function loadProfile() {
  const requestGeneration = generation;
  const identityId = props.identityId;
  status.value = 'loading';
  busy.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const result = await authRequest('/api/patient-profile');
    if (!isCurrent(requestGeneration, identityId)) return;
    if (result?.profile === null) {
      status.value = 'missing';
    } else if (result?.profile && typeof result.profile.id === 'string'
      && typeof result.profile.createdAt === 'string') {
      status.value = 'ready';
    } else {
      throw new Error('Der Kontoserver hat ein ungültiges Profil zurückgegeben.');
    }
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    errorMessage.value = error.message || 'Das Patientenprofil konnte nicht geladen werden.';
    status.value = 'error';
  } finally {
    if (isCurrent(requestGeneration, identityId)) busy.value = false;
  }
}

async function createProfile() {
  if (busy.value || status.value !== 'missing') return;
  const requestGeneration = generation;
  const identityId = props.identityId;
  busy.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const result = await authRequest('/api/patient-profile', {});
    if (!isCurrent(requestGeneration, identityId)) return;
    if (!result?.profile || typeof result.profile.id !== 'string'
      || typeof result.profile.createdAt !== 'string') {
      throw new Error('Der Kontoserver hat kein gültiges Patientenprofil zurückgegeben.');
    }
    status.value = 'ready';
    notice.value = 'Patientenprofil wurde eingerichtet.';
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    errorMessage.value = error.message || 'Das Patientenprofil konnte nicht eingerichtet werden.';
    status.value = 'error';
  } finally {
    if (isCurrent(requestGeneration, identityId)) busy.value = false;
  }
}

watch(() => props.identityId, () => {
  resetForIdentity();
  if (mounted) loadProfile();
});

onMounted(() => {
  mounted = true;
  resetForIdentity();
  loadProfile();
});

onUnmounted(() => {
  mounted = false;
  generation += 1;
  status.value = 'loading';
  busy.value = false;
  errorMessage.value = '';
  notice.value = '';
});
</script>
