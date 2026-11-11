<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { careApi } from './care-api.js';
import { acceptInvitationRequest, declineInvitationRequest, isCreatedInvitation } from './care-state.js';

const props = defineProps({
  identityId: { type: String, required: true },
  role: { type: String, required: true, validator: value => ['physician', 'patient'].includes(value) },
});

const status = ref('loading');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const patients = ref([]);
const relationship = ref(null);
const invitations = ref([]);
const patientEmail = ref('');
const modeLabel = computed(() => props.role === 'physician' ? 'Arztbereich' : 'Betreuungszuordnung');
let generation = 0;
let mounted = false;

function current(request, identity) {
  return mounted && generation === request && identity === props.identityId;
}

function clearState() {
  generation += 1;
  status.value = 'loading';
  busy.value = false;
  error.value = '';
  notice.value = '';
  patients.value = [];
  relationship.value = null;
  invitations.value = [];
  patientEmail.value = '';
}

function isValidPatient(patient) {
  return patient && typeof patient.relationshipId === 'string' && typeof patient.patientId === 'string'
    && typeof patient.displayName === 'string' && patient.status === 'active'
    && typeof patient.startedAt === 'string' && Number.isFinite(Date.parse(patient.startedAt));
}

function isValidInvitation(invitation) {
  return invitation && typeof invitation.id === 'string' && typeof invitation.physicianName === 'string'
    && invitation.status === 'open' && typeof invitation.expiresAt === 'string'
    && Number.isFinite(Date.parse(invitation.expiresAt));
}

async function load() {
  const request = generation;
  const identity = props.identityId;
  status.value = 'loading';
  busy.value = true;
  error.value = '';
  notice.value = '';
  patients.value = [];
  relationship.value = null;
  invitations.value = [];
  try {
    if (props.role === 'physician') {
      const result = await careApi.listPhysicianPatients();
      if (!current(request, identity)) return;
      if (!Array.isArray(result?.patients) || !result.patients.every(isValidPatient)) {
        throw new Error('Der Server hat eine ungültige Patientenliste zurückgegeben.');
      }
      patients.value = result.patients;
    } else {
      const result = await careApi.getPatientCare();
      if (!current(request, identity)) return;
      if (result?.relationship !== null && (!result?.relationship
        || result.relationship.status !== 'active'
        || typeof result.relationship.relationshipId !== 'string'
        || typeof result.relationship.displayName !== 'string')) {
        throw new Error('Der Server hat eine ungültige Betreuungszuordnung zurückgegeben.');
      }
      if (!Array.isArray(result?.invitations) || !result.invitations.every(isValidInvitation)) {
        throw new Error('Der Server hat eine ungültige Einladungsliste zurückgegeben.');
      }
      relationship.value = result.relationship;
      invitations.value = result.invitations;
    }
    status.value = 'ready';
  } catch (cause) {
    if (!current(request, identity)) return;
    error.value = cause.message || 'Der Betreuungsstatus konnte nicht geladen werden.';
    status.value = 'error';
  } finally {
    if (current(request, identity)) busy.value = false;
  }
}

async function invitePatient() {
  if (busy.value || props.role !== 'physician' || status.value !== 'ready') return;
  const request = generation;
  const identity = props.identityId;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await careApi.invitePatient(patientEmail.value.trim());
    if (!current(request, identity)) return;
    if (!isCreatedInvitation(result?.invitation)) {
      throw new Error('Der Server hat keine gültige Einladung zurückgegeben.');
    }
    patientEmail.value = '';
    notice.value = 'Einladung wurde erstellt. Eine Betreuung entsteht erst nach ausdrücklicher Annahme durch den Patienten.';
  } catch (cause) {
    if (current(request, identity)) error.value = cause.message || 'Die Einladung konnte nicht erstellt werden.';
  } finally {
    if (current(request, identity)) busy.value = false;
  }
}

async function acceptInvitation(invitation) {
  if (busy.value || props.role !== 'patient' || invitation.status !== 'open') return;
  const request = generation;
  const identity = props.identityId;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await acceptInvitationRequest(invitation);
    if (!current(request, identity)) return;
    if (!result?.relationship || typeof result.relationship.id !== 'string'
      || typeof result.relationship.physicianUserId !== 'string') {
      throw new Error('Der Server hat die Annahme nicht mit einer gültigen Zuordnung bestätigt.');
    }
    relationship.value = {
      relationshipId: result.relationship.id,
      status: result.relationship.status,
      displayName: invitation.physicianName,
    };
    invitations.value = invitations.value.filter(item => item.id !== invitation.id);
    notice.value = 'Einladung angenommen. Die Zuordnung ist jetzt aktiv.';
  } catch (cause) {
    if (current(request, identity)) error.value = cause.message || 'Die Einladung konnte nicht angenommen werden.';
  } finally {
    if (current(request, identity)) busy.value = false;
  }
}

async function declineInvitation(invitation) {
  if (busy.value || props.role !== 'patient' || invitation.status !== 'open') return;
  const request = generation;
  const identity = props.identityId;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await declineInvitationRequest(invitation);
    if (!current(request, identity)) return;
    if (result?.invitation?.id !== invitation.id || result.invitation.status !== 'declined') {
      throw new Error('Der Server hat die Ablehnung nicht bestätigt.');
    }
    invitations.value = invitations.value.filter(item => item.id !== invitation.id);
    notice.value = 'Einladung abgelehnt.';
  } catch (cause) {
    if (current(request, identity)) error.value = cause.message || 'Die Einladung konnte nicht abgelehnt werden.';
  } finally {
    if (current(request, identity)) busy.value = false;
  }
}

watch(() => [props.identityId, props.role], () => { clearState(); if (mounted) load(); });
onMounted(() => { mounted = true; clearState(); load(); });
onUnmounted(() => { mounted = false; clearState(); });
</script>

<template>
  <section class="care-area card mb-4" aria-labelledby="care-area-title">
    <div class="card-body">
      <h3 id="care-area-title" class="h5">{{ modeLabel }}</h3>
      <p class="small text-muted">Einladungen geben keinen Zugriff. Eine Zuordnung wird erst nach ausdrücklicher Annahme aktiv.</p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Betreuungsstatus wird geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="load">Erneut versuchen</button>
      </div>
      <template v-else-if="role === 'physician'">
        <h4 class="h6">Aktive Patienten</h4>
        <p v-if="patients.length === 0" class="text-muted">Es sind keine aktiven Patienten zugeordnet.</p>
        <ul v-else class="list-group mb-3">
          <li v-for="patient in patients" :key="patient.relationshipId" class="list-group-item d-flex flex-column flex-sm-row justify-content-between gap-1">
            <span>{{ patient.displayName }}</span><span class="small text-muted">Aktiv seit {{ new Date(patient.startedAt).toLocaleDateString() }}</span>
          </li>
        </ul>
        <form class="invite-form" @submit.prevent="invitePatient">
          <label for="care-patient-email" class="form-label">Patient per E-Mail einladen</label>
          <div class="d-flex flex-column flex-sm-row gap-2">
            <input id="care-patient-email" v-model="patientEmail" class="form-control" type="email" required maxlength="254" autocomplete="email" />
            <button class="btn btn-primary flex-shrink-0" type="submit" :disabled="busy">{{ busy ? 'Wird erstellt …' : 'Einladung anlegen' }}</button>
          </div>
        </form>
      </template>
      <template v-else>
        <p v-if="relationship" role="status">Aktiv betreut durch {{ relationship.displayName }}.</p>
        <p v-else class="text-muted">Es ist keine aktive Arztzuordnung vorhanden.</p>
        <h4 class="h6 mt-3">Offene Einladungen</h4>
        <p v-if="invitations.length === 0" class="text-muted">Es liegen keine offenen Einladungen vor.</p>
        <ul v-else class="list-group">
          <li v-for="invitation in invitations" :key="invitation.id" class="list-group-item d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
            <span>Einladung von {{ invitation.physicianName }} · gültig bis {{ new Date(invitation.expiresAt).toLocaleDateString() }}</span>
            <div class="d-flex flex-column flex-sm-row gap-2">
              <button type="button" class="btn btn-primary" :disabled="busy" @click="acceptInvitation(invitation)">Einladung ausdrücklich annehmen</button>
              <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="declineInvitation(invitation)">Ablehnen</button>
            </div>
          </li>
        </ul>
      </template>
      <p v-if="error && status === 'ready'" class="alert alert-danger mt-3" role="alert">{{ error }}</p>
      <p v-if="notice" class="alert alert-info mt-3" role="status" aria-live="polite">{{ notice }}</p>
      <button v-if="status === 'ready'" class="btn btn-link px-0 mt-2" type="button" :disabled="busy" @click="load">Status erneut laden</button>
    </div>
  </section>
</template>

<style scoped>
.invite-form { max-width: 42rem; }
@media (max-width: 575.98px) {
  .care-area .btn { width: 100%; }
}
</style>
