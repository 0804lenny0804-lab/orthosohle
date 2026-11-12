<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { careApi } from './care-api.js';
import { fetchPhysicianMeasurementSession, fetchPhysicianMeasurementSessions, isPhysicianSessionAccessError } from './physician-session-api.js';
import { physicianDetailRequestIsCurrent, physicianRequestIsCurrent } from './physician-session-requests.js';

const props = defineProps({ identityId: { type: String, required: true } });
const emit = defineEmits(['access-error']);

const status = ref('loading');
const patients = ref([]);
const selectedPatientId = ref('');
const sessions = ref([]);
const nextBefore = ref(null);
const selectedSessionId = ref('');
const selectedSession = ref(null);
const visibleSampleCount = ref(100);
const busy = ref(false);
const detailLoading = ref(false);
const error = ref('');
const listError = ref('');
const detailError = ref('');
let generation = 0;
let detailRequestGeneration = 0;
let mounted = false;

function current(request, identity, patientId = '') {
  return physicianRequestIsCurrent({
    mounted,
    requestGeneration: request,
    currentGeneration: generation,
    requestIdentity: identity,
    currentIdentity: props.identityId,
    requestPatientId: patientId,
    currentPatientId: selectedPatientId.value,
  });
}

function detailRequestIsCurrent(request, detailRequest, identity, patientId, sessionId) {
  return physicianDetailRequestIsCurrent({
    mounted,
    requestGeneration: request,
    currentGeneration: generation,
    requestIdentity: identity,
    currentIdentity: props.identityId,
    requestPatientId: patientId,
    currentPatientId: selectedPatientId.value,
    detailRequestGeneration: detailRequest,
    currentDetailRequestGeneration: detailRequestGeneration,
    sessionId,
    selectedSessionId: selectedSessionId.value,
  });
}

function clearPatientData() {
  detailRequestGeneration += 1;
  sessions.value = [];
  nextBefore.value = null;
  selectedSessionId.value = '';
  selectedSession.value = null;
  visibleSampleCount.value = 100;
  listError.value = '';
  detailError.value = '';
  detailLoading.value = false;
}

function clearAfterAccessError(cause) {
  if (!isPhysicianSessionAccessError(cause)) return false;
  emit('access-error', { status: cause.status });
  generation += 1;
  patients.value = [];
  selectedPatientId.value = '';
  clearPatientData();
  busy.value = false;
  status.value = 'ready';
  error.value = 'Der Server hat den Sitzungszugriff abgelehnt. Die Arztansichten werden geschlossen.';
  return true;
}

function isValidPatient(patient) {
  return patient && typeof patient.relationshipId === 'string'
    && typeof patient.patientId === 'string' && typeof patient.displayName === 'string'
    && patient.status === 'active' && typeof patient.startedAt === 'string'
    && Number.isFinite(Date.parse(patient.startedAt));
}

async function loadPatients() {
  const request = generation;
  const identity = props.identityId;
  status.value = identity ? 'loading' : 'error';
  busy.value = true;
  error.value = '';
  patients.value = [];
  selectedPatientId.value = '';
  clearPatientData();
  if (!identity) {
    error.value = 'Melde dich als Arzt an, um zugeordnete Patienten zu sehen.';
    busy.value = false;
    return;
  }
  try {
    const result = await careApi.listPhysicianPatients();
    if (!current(request, identity)) return;
    if (!Array.isArray(result?.patients) || !result.patients.every(isValidPatient)) {
      throw new Error('Der Server hat eine ungültige Patientenliste zurückgegeben.');
    }
    patients.value = result.patients;
    status.value = 'ready';
  } catch (cause) {
    if (!current(request, identity)) return;
    if (!clearAfterAccessError(cause)) {
      error.value = cause.message || 'Die zugeordneten Patienten konnten nicht geladen werden.';
      status.value = 'error';
    }
  } finally {
    if (current(request, identity)) busy.value = false;
  }
}

async function selectPatient(patientId) {
  if (patientId === selectedPatientId.value) return;
  generation += 1;
  const request = generation;
  const identity = props.identityId;
  selectedPatientId.value = patientId;
  clearPatientData();
  error.value = '';
  if (!patientId) {
    busy.value = false;
    return;
  }
  busy.value = true;
  try {
    const page = await fetchPhysicianMeasurementSessions(patientId);
    if (!current(request, identity, patientId)) return;
    sessions.value = page.sessions;
    nextBefore.value = page.nextBefore;
  } catch (cause) {
    if (current(request, identity, patientId)) {
      if (!clearAfterAccessError(cause)) error.value = cause.message || 'Die Sitzungen konnten nicht geladen werden.';
    }
  } finally {
    if (current(request, identity, patientId)) busy.value = false;
  }
}

async function retrySessions() {
  const patientId = selectedPatientId.value;
  if (!patientId) return;
  generation += 1;
  const request = generation;
  const identity = props.identityId;
  clearPatientData();
  error.value = '';
  busy.value = true;
  try {
    const page = await fetchPhysicianMeasurementSessions(patientId);
    if (!current(request, identity, patientId)) return;
    sessions.value = page.sessions;
    nextBefore.value = page.nextBefore;
  } catch (cause) {
    if (current(request, identity, patientId)) {
      if (!clearAfterAccessError(cause)) error.value = cause.message || 'Die Sitzungen konnten nicht geladen werden.';
    }
  } finally {
    if (current(request, identity, patientId)) busy.value = false;
  }
}

async function loadMore() {
  if (!selectedPatientId.value || !nextBefore.value || busy.value) return;
  const request = generation;
  const identity = props.identityId;
  const patientId = selectedPatientId.value;
  busy.value = true;
  listError.value = '';
  try {
    const page = await fetchPhysicianMeasurementSessions(patientId, { before: nextBefore.value });
    if (!current(request, identity, patientId)) return;
    const existing = new Set(sessions.value.map(session => session.id));
    sessions.value.push(...page.sessions.filter(session => !existing.has(session.id)));
    nextBefore.value = page.nextBefore;
  } catch (cause) {
    if (current(request, identity, patientId)) {
      if (!clearAfterAccessError(cause)) listError.value = cause.message || 'Ältere Sitzungen konnten nicht geladen werden.';
    }
  } finally {
    if (current(request, identity, patientId)) busy.value = false;
  }
}

async function toggleDetails(sessionId) {
  if (selectedSessionId.value === sessionId) {
    detailRequestGeneration += 1;
    selectedSessionId.value = '';
    selectedSession.value = null;
    detailError.value = '';
    detailLoading.value = false;
    return;
  }
  selectedSessionId.value = sessionId;
  selectedSession.value = null;
  visibleSampleCount.value = 100;
  await loadDetails(sessionId);
}

async function loadDetails(sessionId) {
  const request = generation;
  const detailRequest = ++detailRequestGeneration;
  const identity = props.identityId;
  const patientId = selectedPatientId.value;
  if (!patientId) return;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const session = await fetchPhysicianMeasurementSession(patientId, sessionId);
    if (detailRequestIsCurrent(request, detailRequest, identity, patientId, sessionId)) {
      selectedSession.value = session;
      visibleSampleCount.value = 100;
    }
  } catch (cause) {
    if (detailRequestIsCurrent(request, detailRequest, identity, patientId, sessionId)) {
      if (!clearAfterAccessError(cause)) detailError.value = cause.message || 'Die Sitzungsdetails konnten nicht geladen werden.';
    }
  } finally {
    if (detailRequestIsCurrent(request, detailRequest, identity, patientId, sessionId)) detailLoading.value = false;
  }
}

function sourceLabel(source) {
  return source === 'simulation' ? 'Simulation · synthetisch' : 'Bluetooth-Empfang';
}

function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

watch(() => props.identityId, () => {
  generation += 1;
  clearPatientData();
  void loadPatients();
});

onMounted(() => {
  mounted = true;
  generation += 1;
  void loadPatients();
});

onUnmounted(() => {
  mounted = false;
  generation += 1;
  patients.value = [];
  selectedPatientId.value = '';
  clearPatientData();
});
</script>

<template>
  <section class="card mb-4" aria-labelledby="physician-sessions-title">
    <div class="card-body">
      <h3 id="physician-sessions-title" class="h5">Messsitzungen zugeordneter Patienten</h3>
      <p class="small text-muted">
        Es werden nur Patienten mit aktiver Zuordnung angeboten. Quellen und Empfangszeiten beruhen auf der App-Auswahl, nicht auf einer Geräteprüfung.
        Eine Lücke zeigt nur, dass in diesem Zeitbereich kein Wert empfangen wurde; sie beweist keinen Geräteausfall. Simulationen sind synthetisch.
      </p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Zugeordnete Patienten werden geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="loadPatients">Erneut versuchen</button>
      </div>
      <template v-else>
        <label class="form-label" for="physician-session-patient">Patient auswählen</label>
        <select id="physician-session-patient" class="form-select mb-3" :value="selectedPatientId" :disabled="busy && !selectedPatientId"
          @change="selectPatient($event.target.value)">
          <option value="">Patient auswählen …</option>
          <option v-for="patient in patients" :key="patient.relationshipId" :value="patient.patientId">
            {{ patient.displayName }}
          </option>
        </select>
        <div v-if="error && !selectedPatientId" class="alert alert-warning" role="alert">
          {{ error }}
          <button type="button" class="btn btn-sm btn-outline-secondary ms-2" :disabled="busy" @click="loadPatients">Zuordnungen erneut laden</button>
        </div>
        <p v-if="patients.length === 0" class="text-muted" role="status">Es sind keine aktiven Patienten zugeordnet.</p>
        <p v-else-if="selectedPatientId && busy" role="status" aria-live="polite">Messsitzungen werden geladen …</p>
        <p v-else-if="selectedPatientId && error" class="alert alert-danger" role="alert">
          {{ error }}
          <button type="button" class="btn btn-sm btn-outline-secondary ms-2" :disabled="busy" @click="retrySessions">Erneut versuchen</button>
        </p>
        <template v-else-if="selectedPatientId">
          <p v-if="sessions.length === 0" class="text-muted" role="status">Für diesen Patienten sind keine Messsitzungen gespeichert.</p>
          <div v-else class="list-group mb-3">
            <button v-for="session in sessions" :key="session.id" type="button"
              class="list-group-item list-group-item-action text-start" :aria-expanded="selectedSessionId === session.id"
              @click="toggleDetails(session.id)">
              <span class="fw-semibold">{{ formatDate(session.startedAt) }}</span>
              <span class="d-block small text-muted">{{ sourceLabel(session.source) }} · Ende {{ formatDate(session.endedAt) }}</span>
            </button>
          </div>
          <p v-if="detailLoading" role="status" aria-live="polite">Sitzungsdetails werden geladen …</p>
          <div v-if="detailError" class="alert alert-danger" role="alert">
            {{ detailError }}
            <button type="button" class="btn btn-sm btn-outline-secondary ms-2" :disabled="detailLoading" @click="selectedSessionId && loadDetails(selectedSessionId)">Erneut versuchen</button>
          </div>
          <section v-if="selectedSession" :aria-label="`Details ${formatDate(selectedSession.startedAt)}`">
            <h4 class="h6">Sekundenaggregate · {{ Math.min(visibleSampleCount, selectedSession.samples.length) }} von {{ selectedSession.samples.length }} Intervallen</h4>
            <p v-if="selectedSession.gaps.length" class="alert alert-warning small" role="note">
              {{ selectedSession.gaps.length }} Empfangslücke(n) zwischen gespeicherten Intervallen. Die Grenzen bezeichnen Zeiten benachbarter Empfangsintervalle:
              <span v-for="(gap, index) in selectedSession.gaps" :key="`${gap.from}-${index}`">
                {{ formatDate(gap.from) }} bis {{ formatDate(gap.to) }}<span v-if="index < selectedSession.gaps.length - 1">; </span>
              </span>
            </p>
            <p v-else class="small text-muted">
              Zwischen gespeicherten Intervallen wurde keine Lücke erkannt. Beginn und Ende ohne Empfang sind nicht erkennbar.
            </p>
            <div class="table-responsive">
              <table class="table table-sm">
                <caption class="visually-hidden">Sekundenaggregate dieser Messsitzung</caption>
                <thead><tr><th scope="col">Empfangssekunde</th><th scope="col">Mittelwert (kg)</th><th scope="col">Maximum (kg)</th><th scope="col">Anzahl</th></tr></thead>
                <tbody>
                  <tr v-for="sample in selectedSession.samples.slice(0, visibleSampleCount)" :key="sample.timestamp">
                    <td>{{ formatDate(sample.timestamp) }}</td><td>{{ sample.avg.toFixed(2) }}</td><td>{{ sample.max.toFixed(2) }}</td><td>{{ sample.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button v-if="visibleSampleCount < selectedSession.samples.length" type="button" class="btn btn-outline-secondary btn-sm" @click="visibleSampleCount += 100">
              Weitere Sekundenaggregate anzeigen
            </button>
          </section>
          <button v-if="nextBefore" type="button" class="btn btn-outline-primary" :disabled="busy" @click="loadMore">
            {{ busy ? 'Wird geladen …' : 'Ältere Sitzungen laden' }}
          </button>
          <p v-if="listError" class="small text-danger mt-2" role="alert">{{ listError }}</p>
        </template>
      </template>
    </div>
  </section>
</template>
