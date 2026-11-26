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
const selectedSection = ref('');
const error = ref('');
let generation = 0;
let mounted = false;

function clear() {
  generation += 1;
  status.value = 'loading';
  patients.value = [];
  selectedPatientId.value = '';
  selectedSection.value = '';
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
  <section class="mb-4" aria-label="Patienten">
      <p v-if="status === 'loading'" role="status" aria-live="polite">Aktive Patienten werden geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p>{{ error }}</p><button type="button" class="btn btn-outline-secondary" @click="loadPatients">Erneut versuchen</button>
      </div>
      <template v-else>
        <p v-if="patients.length === 0" role="status" class="text-muted">Es sind keine aktiven Patienten zugeordnet.</p>
        <template v-else-if="!selectedPatientId">
          <div class="row g-3" aria-label="Aktive Patienten">
            <div v-for="patient in patients" :key="patient.relationshipId" class="col-sm-6 col-lg-4">
              <button type="button" class="card h-100 w-100 text-start patient-card"
                @click="selectedPatientId = patient.patientId; selectedSection = ''">
                <span class="card-body">
                  <strong>{{ patient.displayName }}</strong><br>
                  <small class="text-muted">Aktiv seit {{ new Date(patient.startedAt).toLocaleDateString('de-DE') }}</small>
                  <span class="d-block mt-2">Patientenansicht öffnen <span aria-hidden="true">›</span></span>
                </span>
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <button v-if="!selectedSection" type="button" class="btn btn-link px-0 mb-3" @click="selectedPatientId = ''">‹ Zurück zu Patienten</button>
          <button v-else type="button" class="btn btn-link px-0 mb-3" @click="selectedSection = ''">‹ Zurück zur Auswahl</button>
          <h4 class="h5">{{ patients.find(patient => patient.patientId === selectedPatientId)?.displayName }}</h4>
          <div v-if="!selectedSection" class="row g-3 mt-1" aria-label="Patientenbereiche">
            <div v-for="section in [
              { id: 'history', label: 'Historie', icon: 'bi-clock-history' },
              { id: 'configuration', label: 'Konfiguration', icon: 'bi-sliders' },
              { id: 'personal', label: 'Persönliche Daten', icon: 'bi-person' },
              { id: 'feedback', label: 'Feedback', icon: 'bi-chat-left-text' },
            ]" :key="section.id" class="col-sm-6">
              <button type="button" class="card h-100 w-100 text-start patient-card" @click="selectedSection = section.id">
                <span class="card-body section-card-content"><i :class="`bi ${section.icon}`" aria-hidden="true"></i><strong>{{ section.label }}</strong><span class="section-arrow" aria-hidden="true">›</span></span>
              </button>
            </div>
          </div>
          <template v-else>
            <template v-if="selectedSection === 'personal'">
              <PatientProfileForm :key="`profile-${identityId}-${selectedPatientId}`" :identity-id="identityId" role="physician" :selected-patient-id="selectedPatientId" @access-error="emit('access-error', $event)" />
            </template>
            <TreatmentPlanView v-else-if="selectedSection === 'configuration'" :key="`plan-${identityId}-${selectedPatientId}`" :identity-id="identityId" role="physician" :selected-patient-id="selectedPatientId" @access-error="emit('access-error', $event)" />
            <template v-else>
              <DoctorPatientSessions :key="`sessions-${identityId}-${selectedPatientId}-${selectedSection}`" :identity-id="identityId" :selected-patient-id="selectedPatientId" :view="selectedSection" @access-error="emit('access-error', $event)" />
            </template>
          </template>
        </template>
      </template>
  </section>
</template>

<style scoped>
.patient-card { cursor: pointer; color: inherit; }
.patient-card:hover { border-color: var(--sohle); }
.patient-card .card-body { display: block; }
.patient-card .section-card-content { display: flex; align-items: center; gap: 14px; min-height: 88px; }
.section-card-content i { color: var(--sohle); font-size: 1.3rem; }
.section-arrow { margin-left: auto; color: var(--app-muted); font-size: 1.4rem; }
</style>
