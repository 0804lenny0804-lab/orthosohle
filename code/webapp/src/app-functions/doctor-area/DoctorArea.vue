<template>
  <div class="doctor-area">
    <DoctorAccessRequest v-if="!approved" :identity-id="identityId" :email-verified="emailVerified" @status="approved = $event === 'approved'" />
    <template v-else>
      <Teleport v-if="!stepUp" to="body">
        <dialog ref="dialog" aria-labelledby="doctor-access-heading" @cancel.prevent="goToAccount">
          <h2 id="doctor-access-heading" class="h5">Code bestätigen</h2>
          <p v-if="accessMessage" class="alert alert-warning" role="alert">{{ accessMessage }}</p>
          <TotpVerification :key="`physician-totp-${identityId}-${stepUpGeneration}`" :identity-id="identityId"
            :two-factor-enabled="twoFactorEnabled" @verified="markStepUpVerified" />
          <button type="button" class="btn btn-link" @click="goToAccount">Zum Konto</button>
        </dialog>
      </Teleport>
      <PhysicianPatientWorkspace v-if="stepUp && page === 'doctor'" :key="`workspace-${identityId}`" :identity-id="identityId" @access-error="handleAccessError" />
    </template>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { accountSession } from '../account/account-session.js';
import DoctorAccessRequest from '../account/DoctorAccessRequest.vue';
import TotpVerification from '../additional-totp-check/TotpVerification.vue';
import { totpStepUpApi } from '../additional-totp-check/totp-api.js';
import PhysicianPatientWorkspace from '../patient-doctor-relationship/PhysicianPatientWorkspace.vue';
import { physicianAccessErrorMessage } from '../patient-doctor-relationship/doctor-session-access.js';

const props = defineProps({ identityId: { type: String, required: true }, page: { type: String, required: true } });
const emit = defineEmits(['navigate', 'access-change']);
const dialog = ref(null);
defineExpose({ handleAccessError });
const approved = ref(false);
const stepUp = ref(false);
const stepUpGeneration = ref(0);
const accessMessage = ref('');
const emailVerified = ref(false);
const twoFactorEnabled = ref(false);
let generation = 0;
const checkingProof = ref(false);

async function resetForIdentity() {
  const request = ++generation;
  approved.value = Boolean(accountSession.state.physicianApproved);
  emailVerified.value = Boolean(accountSession.state.emailVerified);
  twoFactorEnabled.value = Boolean(accountSession.state.twoFactorEnabled);
  stepUp.value = false;
  stepUpGeneration.value += 1;
  accessMessage.value = '';
  checkingProof.value = true;
  try {
    const result = await totpStepUpApi.check();
    if (request === generation && result?.authorized === true) stepUp.value = true;
  } catch { /* No server proof means the user must verify. */ }
  finally { if (request === generation) checkingProof.value = false; }
}
function markStepUpVerified() { generation += 1; accessMessage.value = ''; stepUp.value = true; }
async function handleAccessError({ status } = {}) {
  const request = ++generation;
  const identity = props.identityId;
  stepUp.value = false;
  stepUpGeneration.value += 1;
  if (status !== 401 && status !== 403) { accessMessage.value = physicianAccessErrorMessage(status); return; }
  const sessionChecked = !accountSession.state.busy;
  accessMessage.value = 'Der Arztzugriff wurde geschlossen. Anmeldestatus wird geprüft …';
  try { await accountSession.refresh(); } catch { /* Shared account state records a safe error. */ }
  if (request !== generation || identity !== props.identityId) return;
  accessMessage.value = physicianAccessErrorMessage(status, { accountStatus: accountSession.state.status, sessionChecked });
}
function goToAccount() {
  dialog.value?.close();
  emit('navigate', 'account');
}
watch([approved, stepUp, checkingProof, () => props.page], async ([isApproved, verified, checking, page]) => {
  emit('access-change', isApproved && verified);
  await nextTick();
  if (!dialog.value) return;
  if (isApproved && !verified && !checking && page === 'doctor' && !dialog.value.open) dialog.value.showModal();
  else if ((!isApproved || verified || checking || page !== 'doctor') && dialog.value.open) dialog.value.close();
});
watch(() => props.identityId, resetForIdentity);
watch(() => accountSession.state.physicianApproved, value => { approved.value = Boolean(value); if (!value) stepUp.value = false; });
watch(() => accountSession.state.emailVerified, value => { emailVerified.value = Boolean(value); });
watch(() => accountSession.state.twoFactorEnabled, value => { twoFactorEnabled.value = Boolean(value); });
onMounted(resetForIdentity);
onUnmounted(() => { generation += 1; emit('access-change', false); });
</script>

<style scoped>
dialog { width: min(90vw, 36rem); border: 0; border-radius: .75rem; padding: 1.5rem; }
dialog::backdrop { background: #0008; }
</style>
