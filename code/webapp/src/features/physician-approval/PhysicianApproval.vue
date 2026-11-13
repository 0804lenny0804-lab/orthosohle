<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { physicianApprovalApi } from './approval-api.js';
import { consumePhysicianApprovalLink, isApprovalPreview, isApprovalResult } from './approval-state.js';

const props = defineProps({ identityId: { type: String, default: '' } });
const active = ref(false);
const status = ref('idle');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const token = ref('');
const code = ref('');
const application = ref(null);
let generation = 0;
let mounted = false;
let awaitingInitialLogin = false;

function isCurrent(request, identity) {
  return mounted && generation === request && identity === props.identityId;
}

function clearState() {
  generation += 1;
  token.value = '';
  code.value = '';
  application.value = null;
  error.value = '';
  notice.value = '';
  busy.value = false;
  status.value = 'idle';
}

function captureLink() {
  const link = consumePhysicianApprovalLink(new URL(window.location.href), path => {
    window.history.replaceState(window.history.state, '', path);
  });
  if (!link.present) return;
  active.value = true;
  if (!link.token) {
    status.value = 'challenge';
    error.value = 'Der Prüflink ist unvollständig oder ungültig. Fordere einen neuen Link an.';
    return;
  }
  token.value = link.token;
  status.value = 'challenge';
}

async function verifyAndInspect() {
  if (busy.value || !token.value || !/^\d{6,8}$/.test(code.value)) return;
  const request = generation;
  const identity = props.identityId;
  const submittedCode = code.value;
  code.value = '';
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const stepUp = await physicianApprovalApi.verifyTotp(submittedCode);
    if (!isCurrent(request, identity)) return;
    if (stepUp?.verified !== true || stepUp?.expiresInSeconds !== 300) {
      throw new Error('Der Server hat keine gültige aktuelle TOTP-Prüfung bestätigt.');
    }
    const reviewer = await physicianApprovalApi.reviewerStatus();
    if (!isCurrent(request, identity)) return;
    if (reviewer?.reviewer?.authorized !== true || reviewer.reviewer.mfaVerified !== true) {
      throw new Error('Dieses Konto ist nicht als aktuelle Prüferidentität freigegeben.');
    }
    const result = await physicianApprovalApi.inspect(token.value);
    if (!isCurrent(request, identity)) return;
    if (!isApprovalPreview(result?.application)) {
      throw new Error('Der Prüflink ist ungültig, abgelaufen oder nicht mehr offen.');
    }
    application.value = result.application;
    status.value = 'confirm';
    notice.value = 'Prüflink geprüft. Die Arztfreigabe ist noch nicht erfolgt.';
  } catch (cause) {
    if (!isCurrent(request, identity)) return;
    error.value = cause.message || 'Prüflink oder TOTP-Code konnte nicht geprüft werden.';
    application.value = null;
    status.value = 'challenge';
  } finally {
    if (isCurrent(request, identity)) busy.value = false;
  }
}

async function approve() {
  if (busy.value || status.value !== 'confirm' || !token.value) return;
  const request = generation;
  const identity = props.identityId;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await physicianApprovalApi.approve(token.value);
    if (!isCurrent(request, identity)) return;
    if (!isApprovalResult(result?.application)) {
      throw new Error('Der Server hat keine gültige Arztfreigabe bestätigt.');
    }
    token.value = '';
    application.value = result.application;
    status.value = 'complete';
    notice.value = 'Die Arztfreigabe wurde ausdrücklich bestätigt.';
  } catch (cause) {
    if (!isCurrent(request, identity)) return;
    error.value = cause.message || 'Die Arztfreigabe konnte nicht gespeichert werden.';
    application.value = null;
    status.value = cause.status === 403 ? 'challenge' : 'confirm';
  } finally {
    if (isCurrent(request, identity)) busy.value = false;
  }
}

onMounted(() => {
  mounted = true;
  captureLink();
  awaitingInitialLogin = !props.identityId && active.value;
});

watch(() => props.identityId, (identityId, previousIdentityId) => {
  if (!mounted) return;
  if (awaitingInitialLogin && !previousIdentityId && identityId) {
    awaitingInitialLogin = false;
    return;
  }
  awaitingInitialLogin = false;
  clearState();
  active.value = false;
});

onUnmounted(() => {
  mounted = false;
  awaitingInitialLogin = false;
  clearState();
});
</script>

<template>
  <section v-if="active" class="physician-approval card mb-4" aria-labelledby="approval-title">
    <div class="card-body">
      <h2 id="approval-title" class="h5">Arztprüfung bestätigen</h2>
      <p>Der Link allein ändert keinen Kontostatus. Prüfe mit deinem aktuellen Authenticator-Code und bestätige die Freigabe ausdrücklich.</p>
      <p v-if="!identityId && token" role="status">Melde dich zuerst mit dem berechtigten Prüfkonto an. Der Link bleibt für diese Sitzung geöffnet.</p>
      <form v-if="identityId && status === 'challenge' && token" @submit.prevent="verifyAndInspect">
        <label for="approval-totp-code" class="form-label">Aktueller 6- bis 8-stelliger TOTP-Code</label>
        <input id="approval-totp-code" v-model="code" class="form-control mb-3" inputmode="numeric"
          autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" required />
        <button class="btn btn-primary" type="submit" :disabled="busy">
          {{ busy ? 'Wird geprüft …' : 'Code prüfen und Antrag anzeigen' }}
        </button>
      </form>
      <div v-else-if="status === 'confirm' && application">
        <p>Der offene Prüfantrag gehört zu <strong>{{ application.name || 'Unbenanntes Konto' }}</strong> ({{ application.email }}), eingereicht am {{ new Date(application.requestedAt).toLocaleString() }}.</p>
        <p class="alert alert-warning">Erst nach deiner Bestätigung wird der Arztstatus freigegeben.</p>
        <button class="btn btn-danger" type="button" :disabled="busy" @click="approve">
          {{ busy ? 'Wird gespeichert …' : 'Arztfreigabe ausdrücklich bestätigen' }}
        </button>
      </div>
      <p v-else-if="status === 'complete'" role="status">Arztfreigabe bestätigt.</p>
      <p v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</p>
      <p v-if="notice" class="alert alert-info mt-3" role="status" aria-live="polite">{{ notice }}</p>
    </div>
  </section>
</template>

<style scoped>
.physician-approval { max-width: 42rem; }
@media (max-width: 575.98px) {
  .physician-approval .btn { width: 100%; }
}
</style>
