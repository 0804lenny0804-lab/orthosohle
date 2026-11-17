<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { careApi } from './relationship-api.js';
import PatientProfileForm from '../account/PatientProfileForm.vue';
import TreatmentPlanView from './TreatmentPlanView.vue';
import DoctorPatientSessions from './DoctorPatientSessions.vue';

const props = defineProps({ identityId: { type: String, required: true } });
const emit = defineEmits(['access-error']);
const status = ref('loading');
const patients = ref([]);
const selectedPatientId = ref('');
const error = ref('');
let generation = 0;
let mounted = false;

function clear() {
  generation += 1;
  status.value = 'loading';
  patients.value = [];
  selectedPatientId.value = '';
  error.value = '';
}

async function loadPatients() {
  const request = generation;
  const identity = props.identityId;
  status.value = 'loading';
  error.value = '';
  patients.value = [];
  selectedPatientId.value = '';
  try {
    const result = await careApi.listPhysicianPatients();
    if (!mounted || request !== generation || identity !== props.identityId) return;
    if (!Array.isArray(result?.patients) || !result.patients.every(patient =>
      patient && typeof patient.patientId === 'string' && typeof patient.relationshipId === 'string'
      && typeof patient.displayName === 'string' && patient.status === 'active'
      && typeof patient.startedAt === 'string' && Number.isFinite(Date.parse(patient.startedAt)))) {
      throw new Error('Der Server hat eine ungültige Patientenliste zurückgegeben.');
    }
    patients.value = result.patients;
    status.value = 'ready';
  } catch (cause) {
    if (!mounted || request !== generation || identity !== props.identityId) return;
    error.value = cause.message || 'Die zugeordneten Patienten konnten nicht geladen werden.';
    status.value = 'error';
    if ([401, 403].includes(cause.status)) emit('access-error', { status: cause.status });
  }
}

watch(() => props.identityId, () => { clear(); if (mounted) void loadPatients(); });
onMounted(() => { mounted = true; clear(); void loadPatients(); });
onUnmounted(() => { mounted = false; clear(); });
</script>

<template>
  <section class="card mb-4" aria-labelledby="physician-patients-title">
    <div class="card-body">
      <h3 id="physician-patients-title" class="h5">Patientenübersicht</h3>
      <p class="small text-muted">Wähle eine aktive Betreuungszuordnung. Profilangaben, Sitzungen und Therapieplan werden für denselben Patienten angezeigt.</p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Aktive Patienten werden geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p>{{ error }}</p><button type="button" class="btn btn-outline-secondary" @click="loadPatients">Erneut versuchen</button>
      </div>
      <template v-else>
        <p v-if="patients.length === 0" role="status" class="text-muted">Es sind keine aktiven Patienten zugeordnet.</p>
        <template v-else>
          <label for="physician-patient-select" class="form-label">Aktiven Patienten auswählen</label>
          <select id="physician-patient-select" v-model="selectedPatientId" class="form-select mb-3">
            <option value="">Patient auswählen …</option>
            <option v-for="patient in patients" :key="patient.relationshipId" :value="patient.patientId">
              {{ patient.displayName }} · aktiv seit {{ new Date(patient.startedAt).toLocaleDateString('de-DE') }}
            </option>
          </select>
          <p v-if="selectedPatientId" class="small text-muted" role="status">
            Ausgewählt: {{ patients.find(patient => patient.patientId === selectedPatientId)?.displayName }}
          </p>
          <template v-if="selectedPatientId">
            <PatientProfileForm :key="`profile-${identityId}-${selectedPatientId}`" :identity-id="identityId" role="physician" :selected-patient-id="selectedPatientId" @access-error="emit('access-error', $event)" />
            <TreatmentPlanView :key="`plan-${identityId}-${selectedPatientId}`" :identity-id="identityId" role="physician" :selected-patient-id="selectedPatientId" @access-error="emit('access-error', $event)" />
            <DoctorPatientSessions :key="`sessions-${identityId}-${selectedPatientId}`" :identity-id="identityId" :selected-patient-id="selectedPatientId" @access-error="emit('access-error', $event)" />
          </template>
        </template>
      </template>
    </div>
  </section>
</template>
