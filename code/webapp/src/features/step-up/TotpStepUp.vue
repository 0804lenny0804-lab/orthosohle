<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { totpStepUpApi } from './totp-api.js';
import { validStepUp } from './step-up-state.js';

const props = defineProps({
  identityId: { type: String, required: true },
  twoFactorEnabled: { type: Boolean, default: false },
});
const emit = defineEmits(['verified', 'expired']);
const code = ref('');
const status = ref('ready');
const busy = ref(false);
const error = ref('');
let generation = 0;
let expiryTimer = null;
let mounted = false;

function isCurrent(request, identity) {
  return mounted && request === generation && identity === props.identityId;
}

function clearProof(emitExpired = false) {
  generation += 1;
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  code.value = '';
  busy.value = false;
  status.value = 'ready';
  error.value = '';
  if (emitExpired) emit('expired');
}

async function verify() {
  if (busy.value || !props.twoFactorEnabled || !/^\d{6,8}$/.test(code.value)) return;
  const request = generation;
  const identity = props.identityId;
  const submittedCode = code.value;
  code.value = '';
  busy.value = true;
  error.value = '';
  try {
    const proof = await totpStepUpApi.verify(submittedCode);
    if (!isCurrent(request, identity)) return;
    if (!validStepUp(proof)) throw new Error('Der Server hat keine fünfminütige TOTP-Prüfung bestätigt.');
    const guard = await totpStepUpApi.check();
    if (!isCurrent(request, identity)) return;
    if (guard?.authorized !== true) throw new Error('Die aktuelle TOTP-Prüfung konnte nicht bestätigt werden.');
    status.value = 'verified';
    expiryTimer = setTimeout(() => {
      if (!isCurrent(request, identity)) return;
      clearProof(true);
    }, proof.expiresInSeconds * 1000);
    emit('verified', { expiresInSeconds: proof.expiresInSeconds });
  } catch (cause) {
    if (!isCurrent(request, identity)) return;
    status.value = 'ready';
    error.value = cause.message || 'Der TOTP-Code konnte nicht geprüft werden. Bitte erneut versuchen.';
  } finally {
    if (isCurrent(request, identity)) busy.value = false;
  }
}

watch(() => props.identityId, () => clearProof(true));
watch(() => props.twoFactorEnabled, enabled => {
  if (!enabled) clearProof(true);
});

onMounted(() => { mounted = true; });
onUnmounted(() => {
  mounted = false;
  clearProof(true);
});
</script>

<template>
  <section class="totp-step-up card mb-3" aria-labelledby="step-up-title">
    <div class="card-body">
      <h3 id="step-up-title" class="h6">Aktuelle Identitätsprüfung</h3>
      <p v-if="!twoFactorEnabled" class="text-muted" role="status">
        Aktiviere zuerst die Zwei-Faktor-Anmeldung in deinem Konto, um Arztfunktionen freizuschalten.
      </p>
      <template v-else-if="status === 'verified'">
        <p class="text-success" role="status" aria-live="polite">TOTP bestätigt. Die Freigabe gilt bis zu fünf Minuten für diese Sitzung.</p>
        <button type="button" class="btn btn-outline-secondary" @click="clearProof(true)">Erneut prüfen</button>
      </template>
      <form v-else @submit.prevent="verify">
        <label for="step-up-totp" class="form-label">Aktueller Authenticator-Code</label>
        <div class="d-flex flex-column flex-sm-row gap-2">
          <input id="step-up-totp" v-model="code" class="form-control" inputmode="numeric"
            autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" required />
          <button class="btn btn-primary flex-shrink-0" type="submit" :disabled="busy">
            {{ busy ? 'Wird geprüft …' : 'TOTP prüfen' }}
          </button>
        </div>
      </form>
      <p v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.totp-step-up { max-width: 42rem; }
@media (max-width: 575.98px) {
  .totp-step-up .btn { width: 100%; }
}
</style>
