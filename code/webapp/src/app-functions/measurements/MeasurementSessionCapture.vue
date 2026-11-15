<template>
  <section class="card mt-4" aria-labelledby="session-capture-title">
    <div class="card-body">
      <h2 id="session-capture-title" class="h5 text-sohle">Messsitzung</h2>

      <p v-if="!identityId" class="alert alert-warning" role="status">
        Melde dich mit einem bestätigten Konto und eigenem Patientenprofil an, um Messsitzungen zu speichern.
      </p>
      <p v-if="identityId && otherAccountHasDraft" class="alert alert-info" role="note">
        Im aktuellen Browserfenster gibt es eine nicht abgeschlossene Messsitzung eines anderen Kontos. Sie wird hier nicht angezeigt oder hochgeladen. Melde dich wieder mit dem ursprünglichen Konto an, um sie fortzusetzen.
      </p>
      <p v-else-if="profileState === 'loading'" role="status" aria-live="polite">Patientenprofil wird geprüft …</p>
      <p v-else-if="profileState === 'missing'" class="alert alert-warning" role="status">
        Für dieses Konto ist noch kein Patientenprofil eingerichtet. Richte es im Kontobereich ein und prüfe den Status danach erneut.
        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="loadProfile">Profilstatus erneut prüfen</button>
      </p>
      <p v-else-if="profileState === 'error'" class="alert alert-danger" role="alert">
        {{ profileError }}
        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="loadProfile">Erneut versuchen</button>
      </p>

      <template v-if="identityId && profileState === 'ready' && draft">
        <label class="form-label" for="session-source">Datenquelle</label>
        <select id="session-source" v-model="draft.source" class="form-select mb-3" :disabled="draft.active || !!draft.pendingPayload">
          <option value="ble">Bluetooth-Empfang</option>
          <option value="simulation">Simulation (synthetische Werte)</option>
        </select>
        <p v-if="draft.source === 'ble'" class="small text-muted">
          {{ bleConnected ? 'Bluetooth ist verbunden. Die tatsächliche Hardware und Messgenauigkeit sind nicht geprüft.' : 'Bluetooth ist nicht verbunden; starte zuerst die Geräteverbindung.' }}
        </p>
        <p v-else class="small text-muted">
          {{ simulationRunning ? 'Die Simulation läuft. Diese Werte sind synthetisch und keine Messung an einer Person.' : 'Starte zuerst die Simulation. Diese Werte sind synthetisch.' }}
        </p>

        <div class="d-flex flex-wrap gap-2">
          <button v-if="!draft.active && !draft.pendingPayload" type="button" class="btn btn-primary"
            :disabled="!sourceAvailable" @click="startSession">
            Sitzung starten
          </button>
          <button v-if="draft.active" type="button" class="btn btn-danger" @click="stopSession">
            Sitzung stoppen und speichern
          </button>
          <button v-if="draft.pendingPayload" type="button" class="btn btn-primary"
            :disabled="draft.uploading" @click="retryUpload">
            {{ draft.uploading ? 'Upload läuft …' : 'Upload erneut versuchen' }}
          </button>
        </div>

        <p v-if="draft.active" class="alert alert-info mt-3 mb-0" role="status" aria-live="polite">
          Messung läuft · {{ draft.aggregator?.intervalCount || 0 }} Sekunden erfasst. Maximal eine Stunde.
        </p>
        <p v-if="draft.active && !sourceAvailable" class="alert alert-warning mt-3" role="status" aria-live="polite">
          Zurzeit werden keine Werte empfangen.
          <template v-if="draft.lastReceiveAt"> Letzter empfangener Wert: {{ formatReceiveTime(draft.lastReceiveAt) }}.</template>
          Empfangslücken belegen keinen Geräteausfall.
        </p>
        <p v-else-if="draft.active && !draft.lastReceiveAt" class="alert alert-warning mt-3" role="status" aria-live="polite">
          Verbunden, aber noch keine Werte empfangen.
        </p>
        <p v-else-if="draft.active && draft.lastReceiveAt" class="small text-muted mt-3" role="status" aria-live="polite">
          Letzter Empfang: {{ formatReceiveTime(draft.lastReceiveAt) }}.
        </p>
        <p v-if="draft.error" class="alert alert-danger mt-3" role="alert">{{ draft.error }}</p>
        <p v-if="draft.skippedSamples" class="alert alert-warning mt-3" role="alert">
          {{ draft.skippedSamples }} ungültige oder außerhalb des zulässigen Wertebereichs liegende Empfangswerte wurden ausgelassen und nicht gespeichert.
        </p>
        <p v-if="draft.notice" class="alert alert-info mt-3" role="status" aria-live="polite">{{ draft.notice }}</p>
        <p v-if="draft.pendingPayload" class="small text-muted">
          {{ draft.pendingPayload.intervals.length }} Sekundenintervalle warten noch auf die Serverbestätigung. Die Werte bleiben im Arbeitsspeicher; verlasse oder lade diese Seite nicht, bevor der Upload bestätigt wurde.
        </p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { authRequest } from '../account/account-api.js';
import { accountSession } from '../account/account-session.js';
import { createSecondAggregator, getSessionEndTime, isAtSessionLimit, MAX_SESSION_DURATION_MS, MAX_SESSION_INTERVALS } from './measurement-rules.js';
import { draftForIdentity, hasUnsavedDraftForOtherIdentity, hasUnsavedMeasurementDraft } from './measurement-drafts.js';
import { uploadMeasurementSession } from './measurement-session-api.js';

const props = defineProps({
  identityId: { type: String, default: '' },
  bleConnected: { type: Boolean, default: false },
  simulationRunning: { type: Boolean, default: false },
});

const profileState = ref('loading');
const profileError = ref('');
const draft = ref(null);
let generation = 0;
let mounted = false;
const sessionTimers = new Map();

const sourceAvailable = computed(() => draft.value?.source === 'ble' ? props.bleConnected : props.simulationRunning);
const otherAccountHasDraft = computed(() => hasUnsavedDraftForOtherIdentity(props.identityId));

function isCurrent(requestGeneration, identityId) {
  return mounted && requestGeneration === generation && identityId === props.identityId;
}

async function loadProfile() {
  const requestGeneration = generation;
  const identityId = props.identityId;
  if (!identityId) {
    profileState.value = 'missing';
    return;
  }
  profileState.value = 'loading';
  profileError.value = '';
  try {
    const result = await authRequest('/api/patient-profile');
    if (!isCurrent(requestGeneration, identityId)) return;
    if (result?.profile === null) {
      profileState.value = 'missing';
      return;
    }
    if (typeof result?.profile?.id !== 'string' || !result.profile.id) {
      throw new Error('Der Kontoserver hat kein gültiges Patientenprofil zurückgegeben.');
    }
    profileState.value = 'ready';
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    profileError.value = error.message || 'Das Patientenprofil konnte nicht geprüft werden.';
    profileState.value = 'error';
  }
}

function resetForIdentity() {
  generation += 1;
  draft.value = draftForIdentity(props.identityId);
  profileState.value = props.identityId ? 'loading' : 'missing';
  profileError.value = '';
  if (mounted && props.identityId) void loadProfile();
}

function startSession() {
  const current = draft.value;
  if (!current || profileState.value !== 'ready' || !sourceAvailable.value || current.active || current.pendingPayload) return;
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    current.error = 'Dieser Browser kann keine sichere Sitzungskennung erzeugen. Sitzung nicht gestartet.';
    return;
  }
  const startTime = Date.now();
  current.startedAt = new Date(startTime).toISOString();
  current.lastReceiveAt = '';
  current.sessionId = globalThis.crypto.randomUUID();
  current.aggregator = createSecondAggregator();
  current.skippedSamples = 0;
  current.active = true;
  current.error = '';
  current.notice = '';
  const sessionId = current.sessionId;
  const timer = window.setTimeout(() => {
    if (current.active && current.sessionId === sessionId) void finalizeSession(current, current.ownerIdentityId, true);
  }, MAX_SESSION_DURATION_MS);
  sessionTimers.set(sessionId, timer);
}

function acceptSample({ kg, timestamp, source }) {
  const current = draft.value;
  if (!current?.active || source !== current.source) return;
  const sampleTime = Date.parse(timestamp);
  const startTime = Date.parse(current.startedAt);
  if (!Number.isFinite(sampleTime) || sampleTime < startTime) return;
  if (isAtSessionLimit(current.startedAt, sampleTime, current.aggregator.intervalCount)) {
    void stopSession(true);
    return;
  }
  current.lastReceiveAt = new Date(sampleTime).toISOString();
  if (!current.aggregator.add(kg, timestamp)) {
    current.skippedSamples += 1;
    return;
  }
  if (current.aggregator.intervalCount >= MAX_SESSION_INTERVALS) void stopSession(true);
}

async function sendPending(current, identityId) {
  if (!current?.pendingPayload || current.uploading) return;
  if (accountSession.state.identityId !== identityId) {
    current.error = 'Für den Upload muss wieder genau das Konto angemeldet sein, zu dem diese Sitzung gehört.';
    return;
  }
  current.uploading = true;
  current.error = '';
  try {
    await uploadMeasurementSession(current.pendingPayload);
    current.pendingPayload = null;
    current.aggregator = null;
    current.sessionId = '';
    current.startedAt = '';
    current.notice = 'Die Messsitzung wurde vom Server bestätigt.';
  } catch (error) {
    current.error = `${error.message || 'Der Upload ist fehlgeschlagen.'} Die Werte sind noch nicht gespeichert; bitte erneut versuchen.`;
  } finally {
    current.uploading = false;
  }
}

async function finalizeSession(current, identityId, limitReached = false) {
  if (!current?.active) return;
  const timer = sessionTimers.get(current.sessionId);
  if (timer) window.clearTimeout(timer);
  sessionTimers.delete(current.sessionId);
  current.active = false;
  const intervals = current.aggregator.toIntervals();
  if (!intervals.length) {
    current.aggregator = null;
    current.sessionId = '';
    current.startedAt = '';
    current.notice = 'Es wurden keine Werte empfangen; deshalb wurde keine Messsitzung gespeichert.';
    return;
  }
  const startTime = Date.parse(current.startedAt);
  const durationReached = Date.now() - startTime >= MAX_SESSION_DURATION_MS;
  current.pendingPayload = {
    sessionId: current.sessionId,
    source: current.source,
    startedAt: current.startedAt,
    endedAt: getSessionEndTime(current.startedAt, Date.now(), intervals),
    intervals,
  };
  current.notice = limitReached || durationReached
    ? 'Die Grenze von einer Stunde oder 3600 Sekundenintervallen wurde erreicht. Die Sitzung wird gespeichert.'
    : '';
  await sendPending(current, identityId);
}

async function stopSession(limitReached = false) {
  await finalizeSession(draft.value, props.identityId, limitReached);
}

function retryUpload() {
  void sendPending(draft.value, props.identityId);
}

function formatReceiveTime(value) {
  return new Intl.DateTimeFormat('de-DE', { timeStyle: 'medium' }).format(new Date(value));
}

function warnBeforeLeaving(event) {
  if (!hasUnsavedMeasurementDraft()) return;
  event.preventDefault();
  event.returnValue = '';
}

watch(() => props.identityId, resetForIdentity);
onMounted(() => {
  mounted = true;
  resetForIdentity();
  window.addEventListener('beforeunload', warnBeforeLeaving);
});
onUnmounted(() => {
  mounted = false;
  generation += 1;
  for (const timer of sessionTimers.values()) window.clearTimeout(timer);
  sessionTimers.clear();
  window.removeEventListener('beforeunload', warnBeforeLeaving);
});

defineExpose({ acceptSample });
</script>
