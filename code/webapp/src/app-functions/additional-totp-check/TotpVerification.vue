<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { totpStepUpApi } from './totp-api.js';
import { validStepUp } from './totp-verification-state.js';

const props = defineProps({
  identityId: { type: String, required: true },
  twoFactorEnabled: { type: Boolean, default: false },
});
const emit = defineEmits(['verified']);
const code = ref('');
const busy = ref(false);
const error = ref('');
let generation = 0;
let mounted = false;

function isCurrent(request, identity) {
  return mounted && request === generation && identity === props.identityId;
}

function clearProof() {
  generation += 1;
  code.value = '';
  busy.value = false;
  error.value = '';
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
    if (!validStepUp(proof)) throw new Error('Der Server hat die TOTP-Prüfung für diese Sitzung nicht bestätigt.');
    const guard = await totpStepUpApi.check();
    if (!isCurrent(request, identity)) return;
    if (guard?.authorized !== true) throw new Error('Die aktuelle TOTP-Prüfung konnte nicht bestätigt werden.');
    emit('verified');
  } catch (cause) {
    if (!isCurrent(request, identity)) return;
    error.value = cause.message || 'Der TOTP-Code konnte nicht geprüft werden. Bitte erneut versuchen.';
  } finally {
    if (isCurrent(request, identity)) busy.value = false;
  }
}

watch(() => props.identityId, () => clearProof());
watch(() => props.twoFactorEnabled, enabled => {
  if (!enabled) clearProof();
});

onMounted(() => { mounted = true; });
onUnmounted(() => {
  mounted = false;
  clearProof();
});
</script>

<template>
  <section class="totp-step-up mb-3">
    <div>
      <p v-if="!twoFactorEnabled" class="text-muted" role="status">
        Aktiviere zuerst die Zwei-Faktor-Anmeldung in deinem Konto, um Arztfunktionen freizuschalten.
      </p>
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
