<template>
  <section class="card mb-4" aria-labelledby="saved-sessions-title">
    <div class="card-body">
      <h2 id="saved-sessions-title" class="h5 text-sohle">Gespeicherte Messsitzungen</h2>
      <p class="small text-muted">
        Empfangszeiten und Quellen stammen aus der App-Auswahl, nicht aus einer Geräteprüfung. Eine Lücke zeigt nur, dass
        in diesem Zeitbereich kein Wert empfangen wurde. Sie beweist keinen Geräteausfall. Simulationen sind synthetisch.
      </p>
      <p v-if="!identityId" class="alert alert-warning" role="status">Melde dich an, um den deinem Konto zugeordneten Verlauf zu laden.</p>
      <p v-else-if="status === 'loading'" role="status" aria-live="polite">Gespeicherte Sitzungen werden geladen …</p>
      <p v-else-if="status === 'missing-profile'" class="alert alert-warning" role="status">
        Für dieses Konto ist noch kein Patientenprofil eingerichtet. Es gibt daher keinen zugeordneten Sitzungsverlauf.
      </p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p class="mb-2">{{ errorMessage }}</p>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="loadSessions">Erneut versuchen</button>
      </div>
      <template v-else>
        <p v-if="sessions.length === 0" class="text-muted" role="status">Für dieses Konto sind keine Messsitzungen gespeichert.</p>
        <div v-else class="list-group mb-3">
          <button v-for="session in sessions" :key="session.id" type="button"
            class="list-group-item list-group-item-action text-start"
            :aria-expanded="selectedId === session.id"
            @click="toggleDetails(session.id)">
            <span class="fw-semibold">{{ formatDate(session.startedAt) }}</span>
            <span class="d-block small text-muted">{{ sourceLabel(session.source) }} · {{ formatDate(session.endedAt) }}</span>
          </button>
        </div>
        <p v-if="detailLoading" role="status" aria-live="polite">Sitzungsdetails werden geladen …</p>
        <div v-if="detailError" class="alert alert-danger" role="alert">
          {{ detailError }}
          <button type="button" class="btn btn-sm btn-outline-secondary ms-2" :disabled="busy" @click="selectedId && loadDetails(selectedId)">Erneut versuchen</button>
        </div>
        <section v-if="selectedSession" class="session-detail" :aria-label="`Details ${formatDate(selectedSession.startedAt)}`">
          <h3 class="h6">Sekundenaggregate · {{ visibleSamples.length }} von {{ selectedSession.samples.length }} Intervallen</h3>
          <p v-if="selectedSession.gaps.length" class="alert alert-warning small" role="note">
            {{ selectedSession.gaps.length }} Empfangslücke(n) zwischen gespeicherten Intervallen:
            <span v-for="(gap, index) in selectedSession.gaps" :key="`${gap.from}-${index}`">
              {{ formatDate(gap.from) }} bis {{ formatDate(gap.to) }}<span v-if="index < selectedSession.gaps.length - 1">; </span>
            </span>
          </p>
          <p v-else class="small text-muted">Zwischen gespeicherten Intervallen wurde keine Lücke erkannt. Beginn und Ende ohne Empfang sind nicht erkennbar.</p>
          <div class="table-responsive">
            <table class="table table-sm">
              <caption class="visually-hidden">Sekundenaggregate dieser Messsitzung</caption>
              <thead><tr><th scope="col">Empfangssekunde</th><th scope="col">Mittelwert (kg)</th><th scope="col">Maximum (kg)</th><th scope="col">Anzahl</th></tr></thead>
              <tbody>
                <tr v-for="sample in visibleSamples" :key="sample.timestamp">
                  <td>{{ formatDate(sample.timestamp) }}</td><td>{{ sample.avg.toFixed(2) }}</td><td>{{ sample.max.toFixed(2) }}</td><td>{{ sample.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button v-if="visibleSamples.length < selectedSession.samples.length" type="button" class="btn btn-outline-secondary btn-sm"
            @click="detailVisibleCount += 100">
            Weitere Sekundenaggregate anzeigen
          </button>
        </section>
        <button v-if="nextBefore" type="button" class="btn btn-outline-primary" :disabled="busy" @click="loadMore">
          {{ busy ? 'Wird geladen …' : 'Ältere Sitzungen laden' }}
        </button>
        <p v-if="listError" class="small text-danger mt-2" role="alert">{{ listError }}</p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { authRequest } from '../account/auth-api.js';
import { fetchMeasurementSession, fetchMeasurementSessions } from './session-api.js';

const props = defineProps({ identityId: { type: String, default: '' } });
const status = ref('loading');
const sessions = ref([]);
const nextBefore = ref(null);
const selectedId = ref('');
const selectedSession = ref(null);
const errorMessage = ref('');
const detailError = ref('');
const listError = ref('');
const busy = ref(false);
const detailLoading = ref(false);
const detailVisibleCount = ref(100);
let generation = 0;
let mounted = false;
const visibleSamples = computed(() => selectedSession.value?.samples.slice(0, detailVisibleCount.value) || []);

function current(requestGeneration, identityId) {
  return mounted && generation === requestGeneration && props.identityId === identityId;
}

function reset() {
  generation += 1;
  sessions.value = [];
  nextBefore.value = null;
  selectedId.value = '';
  selectedSession.value = null;
  detailVisibleCount.value = 100;
  errorMessage.value = '';
  detailError.value = '';
  listError.value = '';
  busy.value = false;
  detailLoading.value = false;
  status.value = props.identityId ? 'loading' : 'error';
  if (mounted && props.identityId) void loadSessions();
}

async function loadSessions() {
  const requestGeneration = generation;
  const identityId = props.identityId;
  if (!identityId) return;
  status.value = 'loading';
  errorMessage.value = '';
  busy.value = true;
  try {
    const profile = await authRequest('/api/patient-profile');
    if (!current(requestGeneration, identityId)) return;
    if (profile?.profile === null) {
      status.value = 'missing-profile';
      return;
    }
    if (typeof profile?.profile?.id !== 'string') throw new Error('Das Patientenprofil konnte nicht bestätigt werden.');
    const page = await fetchMeasurementSessions();
    if (!current(requestGeneration, identityId)) return;
    sessions.value = page.sessions;
    nextBefore.value = page.nextBefore;
    status.value = 'ready';
  } catch (error) {
    if (!current(requestGeneration, identityId)) return;
    errorMessage.value = error.message || 'Der Sitzungsverlauf konnte nicht geladen werden.';
    status.value = 'error';
  } finally {
    if (current(requestGeneration, identityId)) busy.value = false;
  }
}

async function loadMore() {
  if (!nextBefore.value || busy.value) return;
  const requestGeneration = generation;
  const identityId = props.identityId;
  busy.value = true;
  listError.value = '';
  try {
    const page = await fetchMeasurementSessions({ before: nextBefore.value });
    if (!current(requestGeneration, identityId)) return;
    const existing = new Set(sessions.value.map((session) => session.id));
    sessions.value.push(...page.sessions.filter((session) => !existing.has(session.id)));
    nextBefore.value = page.nextBefore;
  } catch (error) {
    if (current(requestGeneration, identityId)) listError.value = error.message || 'Ältere Sitzungen konnten nicht geladen werden.';
  } finally {
    if (current(requestGeneration, identityId)) busy.value = false;
  }
}

async function toggleDetails(id) {
  if (selectedId.value === id) {
    selectedId.value = '';
    selectedSession.value = null;
    detailError.value = '';
    return;
  }
  selectedId.value = id;
  selectedSession.value = null;
  detailVisibleCount.value = 100;
  await loadDetails(id);
}

async function loadDetails(id) {
  const requestGeneration = generation;
  const identityId = props.identityId;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const result = await fetchMeasurementSession(id);
    if (current(requestGeneration, identityId) && selectedId.value === id) {
      selectedSession.value = result;
      detailVisibleCount.value = 100;
    }
  } catch (error) {
    if (current(requestGeneration, identityId) && selectedId.value === id) detailError.value = error.message || 'Die Sitzungsdetails konnten nicht geladen werden.';
  } finally {
    if (current(requestGeneration, identityId) && selectedId.value === id) detailLoading.value = false;
  }
}

function sourceLabel(source) { return source === 'simulation' ? 'Simulation · synthetisch' : 'Bluetooth-Empfang'; }
function formatDate(value) { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)); }

watch(() => props.identityId, reset);
onMounted(() => { mounted = true; reset(); });
onUnmounted(() => { mounted = false; generation += 1; });
</script>
