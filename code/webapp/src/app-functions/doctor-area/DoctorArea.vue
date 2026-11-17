<template>
  <div class="doctor-area">
    <section v-if="page === 'doctor'" class="card mb-4">
      <div class="card-body">
        <h2 class="h5">Willkommen im Arztbereich</h2>
        <p class="mb-0">Verwalte deine Betreuungsanfragen, lade Patienten ein und öffne freigegebene Patientenansichten.</p>
      </div>
    </section>
    <DoctorAccessRequest v-if="!approved" :identity-id="identityId" :email-verified="emailVerified" @status="approved = $event === 'approved'" />
    <template v-else>
      <section class="card mb-4" aria-labelledby="doctor-access-heading">
        <div class="card-body">
          <h2 id="doctor-access-heading" class="h5">Geschützter Arztzugriff</h2>
          <p v-if="accessMessage" class="alert alert-warning" role="alert">{{ accessMessage }}</p>
          <p v-if="!stepUp" class="small text-muted">Bestätige deine Identität erneut, bevor Patientenansichten geladen werden.</p>
          <TotpVerification :key="`physician-totp-${identityId}-${stepUpGeneration}`" :identity-id="identityId"
            :two-factor-enabled="twoFactorEnabled" @verified="markStepUpVerified" @expired="stepUp = false" />
        </div>
      </section>
      <template v-if="stepUp">
        <PhysicianPatientWorkspace v-if="page === 'patients'" :key="`workspace-${identityId}`" :identity-id="identityId" @access-error="handleAccessError" />
        <CareArea v-if="page === 'invitations'" :key="`invitations-${identityId}`" :identity-id="identityId" role="physician" @access-error="handleAccessError" />
        <section v-if="page === 'doctor'" class="row g-3" aria-label="Arztbereich Schnellzugriff">
          <div class="col-md-6"><button class="card h-100 text-start w-100" type="button" @click="$emit('navigate', 'patients')"><span class="card-body"><strong>Patienten</strong><br><span class="small text-muted">Aktive Zuordnungen und freigegebene Ansichten</span></span></button></div>
          <div class="col-md-6"><button class="card h-100 text-start w-100" type="button" @click="$emit('navigate', 'invitations')"><span class="card-body"><strong>Einladungen</strong><br><span class="small text-muted">Anfragen bearbeiten oder Patienten einladen</span></span></button></div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { accountSession } from '../account/account-session.js';
import DoctorAccessRequest from '../account/DoctorAccessRequest.vue';
import TotpVerification from '../additional-totp-check/TotpVerification.vue';
import CareArea from '../patient-doctor-relationship/RelationshipArea.vue';
import PhysicianPatientWorkspace from '../patient-doctor-relationship/PhysicianPatientWorkspace.vue';
import { physicianAccessErrorMessage, shouldClosePhysicianAccessOnResume } from '../patient-doctor-relationship/doctor-session-access.js';

const props = defineProps({ identityId: { type: String, required: true }, page: { type: String, required: true } });
defineEmits(['navigate']);
const approved = ref(false);
const stepUp = ref(false);
const stepUpGeneration = ref(0);
const accessMessage = ref('');
const emailVerified = ref(false);
const twoFactorEnabled = ref(false);
let generation = 0;

function resetForIdentity() {
  generation += 1;
  approved.value = Boolean(accountSession.state.physicianApproved);
  emailVerified.value = Boolean(accountSession.state.emailVerified);
  twoFactorEnabled.value = Boolean(accountSession.state.twoFactorEnabled);
  stepUp.value = false;
  stepUpGeneration.value += 1;
  accessMessage.value = '';
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
function closeOnResume(eventType) {
  const type = typeof eventType === 'string' ? eventType : eventType?.type;
  if (!shouldClosePhysicianAccessOnResume({ active: stepUp.value, eventType: type, visibilityState: document.visibilityState })) return;
  generation += 1;
  stepUp.value = false;
  stepUpGeneration.value += 1;
  accessMessage.value = 'Die Arztansichten wurden beim Zurückkehren geschlossen. Bitte TOTP erneut bestätigen.';
}
function onVisibilityChange() { closeOnResume('visibilitychange'); }
watch(() => props.identityId, resetForIdentity);
watch(() => accountSession.state.physicianApproved, value => { approved.value = Boolean(value); if (!value) stepUp.value = false; });
watch(() => accountSession.state.emailVerified, value => { emailVerified.value = Boolean(value); });
watch(() => accountSession.state.twoFactorEnabled, value => { twoFactorEnabled.value = Boolean(value); });
onMounted(() => { resetForIdentity(); window.addEventListener('focus', closeOnResume); document.addEventListener('visibilitychange', onVisibilityChange); });
onUnmounted(() => { generation += 1; window.removeEventListener('focus', closeOnResume); document.removeEventListener('visibilitychange', onVisibilityChange); });
</script>
