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
      <p v-if="profileState === 'loading' && identityId && !otherAccountHasDraft" role="status" aria-live="polite">Patientenprofil wird geprüft …</p>
      <p v-else-if="profileState === 'missing' && identityId && !otherAccountHasDraft" class="alert alert-warning" role="status">
        Für dieses Konto ist noch kein Patientenprofil eingerichtet. Richte es im Kontobereich ein und prüfe den Status danach erneut.
        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="loadProfile">Profilstatus erneut prüfen</button>
      </p>
      <p v-else-if="profileState === 'error' && identityId && !otherAccountHasDraft" class="alert alert-danger" role="alert">
        {{ profileError }}
        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="loadProfile">Erneut versuchen</button>
      </p>
      <p v-if="captureStatus" class="alert alert-info" role="status" aria-live="polite">{{ captureStatus }}</p>

      <template v-if="identityId && profileState === 'ready' && draft">
        <p v-if="draft.source === 'simulation'" class="small text-muted" role="status">Simulation · keine echten Messwerte</p>

        <div class="d-flex flex-wrap gap-2">
          <button v-if="draft.source === 'simulation' && !draft.active && !draft.pendingPayload" type="button" class="btn btn-primary"
            :disabled="!sourceAvailable || !draft.recoveryChecked || draft.recoveryBlocked || otherAccountHasDraft" @click="startSession">
            Sitzung starten
          </button>
          <button v-if="draft.active && draft.source === 'simulation'" type="button" class="btn btn-danger" @click="stopSession">
            Sitzung stoppen und speichern
          </button>
          <button v-if="draft.pendingPayload || draft.checkpointQueue.length || (!draft.active && draft.rolloverSamples.length)" type="button" class="btn btn-primary"
            :disabled="draft.uploading" @click="retryUpload">
            {{ draft.uploading ? 'Checkpoint läuft …' : draft.checkpointQueue.length ? 'Übertragung erneut versuchen' : 'BLE-Werte fortsetzen' }}
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
        <p v-if="draft.rolloverSamples.length" class="alert alert-warning mt-3" role="status" aria-live="polite">
          {{ draft.rolloverSamples.length }} BLE-Werte warten im Arbeitsspeicherpuffer (maximal 6000 Werte) auf die Bestätigung des vorherigen Segments. Sie werden danach einem Folgesegment derselben BLE-Verbindung zugeordnet.
        </p>
        <p v-if="draft.rolloverOverflowSamples" class="alert alert-danger mt-3" role="alert">
          {{ draft.rolloverOverflowSamples }} BLE-Werte konnten wegen des Pufferslimits nicht behalten werden. Die Überlastung wird angezeigt und die Werte wurden nicht stillschweigend verworfen.
        </p>
        <p v-if="draft.skippedSamples" class="alert alert-warning mt-3" role="alert">
          {{ draft.skippedSamples }} ungültige oder außerhalb des zulässigen Wertebereichs liegende Empfangswerte wurden ausgelassen und nicht gespeichert.
        </p>
        <p v-if="draft.notice" class="alert alert-info mt-3" role="status" aria-live="polite">{{ draft.notice }}</p>
        <p v-if="draft.checkpointQueue.length || draft.pendingPayload" class="small text-muted">
          {{ draft.checkpointQueue.reduce((total, chunk) => total + chunk.intervals.length, 0) }} Sekundenintervalle warten auf Serverbestätigung. Nicht bestätigte Werte bleiben nur im Arbeitsspeicher; verlasse oder lade diese Seite nicht, bis die Übertragung bestätigt wurde.
        </p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { authRequest } from '../account/account-api.js';
import { accountSession } from '../account/account-session.js';
import { canAutoStartBleSession, completeBleCheckpointSegment, consumePendingBleSamples, createSecondAggregator, isAtSessionLimit, MAX_SESSION_DURATION_MS, MAX_SESSION_INTERVALS, MAX_SESSION_VALUE } from './measurement-rules.js';
import { draftForIdentity, hasUnsavedDraftForOtherIdentity, hasUnsavedMeasurementDraft } from './measurement-drafts.js';
import { drainMeasurementCheckpointQueue, enqueueClosedMeasurementCheckpoints, enqueueMeasurementCheckpoints } from './measurement-checkpoint-queue.js';
import { bufferBleRolloverSample, deliverSessionFeedbackIfReady, requestSessionFeedback } from './measurement-ble-rollover.js';
import { fetchActiveMeasurementSessions, uploadMeasurementCheckpoint, uploadMeasurementSession } from './measurement-session-api.js';

const props = defineProps({
  identityId: { type: String, default: '' },
  bleConnected: { type: Boolean, default: false },
  simulationRunning: { type: Boolean, default: false },
});
const emit = defineEmits(['session-completed']);

const profileState = ref('loading');
const profileError = ref('');
const captureStatus = ref('');
const draft = ref(null);
let generation = 0;
let mounted = false;
const sessionTimers = new Map();
const checkpointTimers = new Map();
let activeBleDraft = null;
let bleConnectionEpoch = 0;
const emitSessionFeedback = (payload) => emit('session-completed', payload);

const sourceAvailable = computed(() => draft.value?.source === 'ble' ? props.bleConnected : props.simulationRunning);
const otherAccountHasDraft = computed(() => hasUnsavedDraftForOtherIdentity(props.identityId));

function stopBleSessionOnDisconnect(connected, wasConnected) {
  if (connected && !wasConnected) {
    bleConnectionEpoch += 1;
    captureStatus.value = '';
    if (activeBleDraft?.active && activeBleDraft.ownerIdentityId === props.identityId
      && activeBleDraft.source === 'ble' && !activeBleDraft.finalizing) {
      activeBleDraft.bleEpoch = bleConnectionEpoch;
    }
    return;
  }
  if (!wasConnected || connected) return;

  const current = activeBleDraft || draft.value;
  if (current?.source === 'ble') {
    const disconnectedEpoch = current.active ? current.bleEpoch : bleConnectionEpoch;
    if (!current.disconnectedBleEpochs.includes(disconnectedEpoch)) current.disconnectedBleEpochs.push(disconnectedEpoch);
    if (current.active) {
      captureStatus.value = '';
      void finalizeSession(current, current.ownerIdentityId, false, 'disconnect');
      return;
    }
    if (current.finalizing || current.rolloverPending) {
      if (!current.rolloverSamples.some((sample) => sample.epoch === disconnectedEpoch)) {
        if (current.finalizing && current.sessionId) current.feedbackRequestedSessionId = current.sessionId;
        else requestFeedbackForSession(current, current.lastCompletedBleSessionId);
      }
      return;
    }
    if (current.lastCompletedBleSessionId && current.lastCompletedBleEpoch === disconnectedEpoch) {
      requestFeedbackForSession(current, current.lastCompletedBleSessionId);
      return;
    }
  }
  if (draft.value?.source === 'ble' && !draft.value.active && !draft.value.sessionId
    && !draft.value.pendingPayload && !draft.value.checkpointQueue.length) {
    captureStatus.value = 'Bluetooth wurde getrennt, bevor Profilprüfung und erster gültiger Wert den automatischen Sitzungsstart erlaubten. Es wurde keine Sitzung angelegt.';
  }
}

watch(() => props.bleConnected, stopBleSessionOnDisconnect, { flush: 'sync', immediate: true });

watch([draft, () => props.simulationRunning, () => draft.value?.active, () => draft.value?.pendingPayload, () => draft.value?.checkpointQueue.length], ([current, simulation]) => {
  if (current && !current.active && !current.pendingPayload && !current.checkpointQueue.length) current.source = simulation ? 'simulation' : 'ble';
}, { immediate: true });

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
    await recoverActiveSession(requestGeneration, identityId);
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    profileError.value = error.message || 'Das Patientenprofil konnte nicht geprüft werden.';
    profileState.value = 'error';
  }
}

async function recoverActiveSession(requestGeneration, identityId) {
  try {
    const sessions = await fetchActiveMeasurementSessions();
    if (!isCurrent(requestGeneration, identityId)) return;
    const current = draft.value;
    if (current.active || current.pendingPayload || current.checkpointQueue.length) {
      current.recoveryChecked = true;
      return;
    }
    current.recoveryChecked = true;
    current.recoveryBlocked = false;
    if (sessions.length > 1) {
      current.recoveryBlocked = true;
      current.error = 'Der Server meldet mehrere offene Messsitzungen für dieses Konto. Sie wurden nicht zusammengeführt; bitte nicht neu starten. Die Sitzungen bleiben serverseitig erhalten.';
      return;
    }
    const [session] = sessions;
    if (!session) return;
    current.source = session.source;
    if (session.source === 'ble' && props.bleConnected) current.bleEpoch = bleConnectionEpoch;
    current.sessionId = session.id;
    current.startedAt = session.startedAt;
    current.lastReceiveAt = session.samples.at(-1)?.timestamp || '';
    current.aggregator = createSecondAggregator(session.samples);
    current.checkpointSequence = session.sequence;
    current.checkpointedIntervalCount = session.samples.length;
    current.active = true;
    current.finalizing = false;
    current.error = '';
    if (session.source === 'ble') activeBleDraft = current;
    armSessionTimers(current);
    current.notice = 'Eine serverseitig bestätigte aktive Messsitzung wurde wieder aufgenommen.';
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    draft.value.recoveryBlocked = true;
    draft.value.error = `${error.message || 'Aktive Messsitzungen konnten nicht geprüft werden.'} Eine neue Sitzung wird nicht automatisch fortgesetzt.`;
  }
}

function resetForIdentity() {
  generation += 1;
  draft.value = draftForIdentity(props.identityId);
  if (draft.value) deliverSessionFeedbackIfReady(draft.value, accountSession.state.identityId, emitSessionFeedback);
  if (draft.value?.active && draft.value.sessionId && !sessionTimers.has(draft.value.sessionId)) {
    if (draft.value.source === 'ble') activeBleDraft = draft.value;
    armSessionTimers(draft.value);
  }
  profileState.value = props.identityId ? 'loading' : 'missing';
  profileError.value = '';
  if (mounted && props.identityId) void loadProfile();
}

function startSession(startTime = Date.now(), rollover = false) {
  const current = draft.value;
  if (!current || profileState.value !== 'ready' || !current.recoveryChecked || (!rollover && !sourceAvailable.value) || current.active || current.pendingPayload || current.recoveryBlocked
    || current.checkpointQueue.length || current.finalizing || (!rollover && current.rolloverSamples.length) || otherAccountHasDraft.value
    || (current.source === 'ble' && activeBleDraft && activeBleDraft !== current)) return;
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    current.error = 'Dieser Browser kann keine sichere Sitzungskennung erzeugen. Sitzung nicht gestartet.';
    return;
  }
  current.startedAt = new Date(startTime).toISOString();
  current.lastReceiveAt = '';
  current.sessionId = globalThis.crypto.randomUUID();
  current.aggregator = createSecondAggregator();
  current.checkpointQueue = [];
  current.checkpointSequence = 0;
  current.checkpointedIntervalCount = 0;
  current.finalizing = false;
  current.recoveryBlocked = false;
  current.skippedSamples = 0;
  current.active = true;
  if (current.source === 'ble') {
    activeBleDraft = current;
    current.bleEpoch = rollover ? current.rolloverSamples[0]?.epoch || bleConnectionEpoch : bleConnectionEpoch;
  }
  current.error = '';
  current.notice = '';
  const sessionId = current.sessionId;
  armSessionTimers(current);
}

function armSessionTimers(current) {
  const sessionId = current.sessionId;
  const startTime = Date.parse(current.startedAt);
  const timer = window.setTimeout(() => {
    if (current.active && current.sessionId === sessionId) void finalizeSession(current, current.ownerIdentityId, true, 'limit');
  }, Math.max(0, startTime + MAX_SESSION_DURATION_MS - Date.now()));
  sessionTimers.set(sessionId, timer);
  const checkpointTimer = window.setInterval(() => {
    if (current.active && current.sessionId === sessionId) {
      enqueueClosedMeasurementCheckpoints(current);
      void sendCheckpointQueue(current);
    }
  }, 1000);
  checkpointTimers.set(sessionId, checkpointTimer);
}

function acceptSample({ kg, timestamp, source }) {
  const sampleTime = Date.parse(timestamp);
  const value = Number(kg);
  if (!Number.isFinite(sampleTime) || !Number.isFinite(value) || value < 0 || value > 1_000_000) return;

  let current = draft.value;
  if (source === 'ble' && current?.source === 'ble' && current.ownerIdentityId === props.identityId
    && (current.finalizing || current.rolloverPending)) {
    bufferBleSample(current, value, sampleTime);
    return;
  }
  if (source === 'ble' && current?.active && current.source === 'ble' && current.ownerIdentityId === props.identityId
    && current.bleEpoch !== bleConnectionEpoch) {
    bufferBleSample(current, value, sampleTime);
    current.rolloverPending = true;
    void finalizeSession(current, current.ownerIdentityId, true, 'limit');
    return;
  }
  if (source === 'ble' && current?.ownerIdentityId === props.identityId && current.source === 'ble'
    && !current.active && current.lastCompletedBleSessionId && current.lastCompletedBleEpoch !== bleConnectionEpoch) {
    bufferBleSample(current, value, sampleTime);
    current.rolloverPending = true;
    void startNextRolloverSegment(current);
    return;
  }
  if (source === 'ble' && current?.finalizing) {
    bufferBleSample(current, value, sampleTime);
    return;
  }
  if (canAutoStartBleSession({
    source, connected: props.bleConnected, profileReady: profileState.value === 'ready',
    ownerIdentityId: current?.ownerIdentityId, identityId: props.identityId,
    active: current?.active,
    pending: !!current?.pendingPayload || current?.checkpointQueue.length > 0 || current?.finalizing,
  }) && value <= MAX_SESSION_VALUE && current?.recoveryChecked && !current?.recoveryBlocked && !otherAccountHasDraft.value
    && (!activeBleDraft || activeBleDraft === current)) {
    startSession(sampleTime);
    current = draft.value;
  }
  if (!current?.active || source !== current.source) return;
  const startTime = Date.parse(current.startedAt);
  if (!Number.isFinite(sampleTime) || sampleTime < startTime) return;
  if (isAtSessionLimit(current.startedAt, sampleTime, current.aggregator.intervalCount)) {
    if (source === 'ble' && current.ownerIdentityId === props.identityId) {
      bufferBleSample(current, value, sampleTime);
    }
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

function bufferBleSample(current, kg, sampleTime) {
  current.error = bufferBleRolloverSample(current, {
    kg, sampleTime, identityId: props.identityId, epoch: bleConnectionEpoch,
  }) || current.error;
}

function requestFeedbackForSession(current, sessionId) {
  requestSessionFeedback(current, sessionId, accountSession.state.identityId, emitSessionFeedback);
}

function deliverFeedbackIfReady(current) {
  deliverSessionFeedbackIfReady(current, accountSession.state.identityId, emitSessionFeedback);
}

async function sendCheckpointQueue(current) {
  if (!current?.checkpointQueue.length || current.uploading) return;
  const ownerIdentityId = current.ownerIdentityId;
  if (accountSession.state.identityId !== ownerIdentityId) {
    current.error = 'Für die Übertragung muss wieder genau das Konto angemeldet sein, zu dem diese Sitzung gehört. Die ausstehenden Werte bleiben im Arbeitsspeicher.';
    return;
  }
  await drainMeasurementCheckpointQueue(current, {
    currentIdentityId: () => accountSession.state.identityId,
    upload: uploadMeasurementCheckpoint,
    onAcknowledged(chunk) {
      if (chunk.completed) {
      const completedSessionId = chunk.sessionId;
      if (chunk.source === 'ble') {
        const followup = completeBleCheckpointSegment(current, completedSessionId, chunk.bleEpoch);
        if (followup.feedbackSessionId) requestFeedbackForSession(current, followup.feedbackSessionId);
      }
      current.notice = 'Die Messsitzung wurde vom Server bestätigt.';
      if (current.source === 'ble' && current.rolloverSamples.length) void startNextRolloverSegment(current);
      else if (current.rolloverPending) current.rolloverPending = false;
      }
    }
  });
}

function startNextRolloverSegment(current) {
  if (!current?.rolloverSamples.length || current.active || current.finalizing || current.checkpointQueue.length) return;
  if (accountSession.state.identityId !== current.ownerIdentityId) {
    current.error = 'Die Folgewerte bleiben dem ursprünglichen Konto zugeordnet. Melde dich damit an, um die Übertragung fortzusetzen.';
    return;
  }
  const first = current.rolloverSamples[0];
  if (first.identityId !== current.ownerIdentityId) {
    current.error = 'Die wartenden BLE-Werte gehören nicht zum aktiven Konto. Sie wurden nicht einer anderen Sitzung zugeordnet.';
    return;
  }
  current.source = 'ble';
  current.rolloverPending = false;
  current.finalizing = false;
  startSession(Date.parse(first.timestamp), true);
  if (!current.active) {
    current.error = 'Das BLE-Folgesegment konnte nicht gestartet werden. Die wartenden Werte bleiben erhalten.';
    return;
  }

  const result = consumePendingBleSamples(current, current.ownerIdentityId, current.bleEpoch);
  if (result.blocked) {
    current.error = 'Die wartenden BLE-Werte konnten nicht sicher zugeordnet werden. Sie bleiben im Arbeitsspeicher.';
    return;
  }
  if (result.reachedLimit) {
    void finalizeSession(current, current.ownerIdentityId, true, 'limit');
    return;
  }
  const moreSameEpoch = current.rolloverSamples.some((sample) => sample.epoch === current.bleEpoch);
  if (moreSameEpoch || current.disconnectedBleEpochs.includes(current.bleEpoch)) {
    current.rolloverPending = true;
    void finalizeSession(current, current.ownerIdentityId, !moreSameEpoch, moreSameEpoch ? 'limit' : 'disconnect');
    return;
  }
  if (current.rolloverSamples.length) {
    current.rolloverPending = true;
    void finalizeSession(current, current.ownerIdentityId, true, 'limit');
  } else {
    current.rolloverPending = false;
  }
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

async function finalizeSession(current, identityId, limitReached = false, cause = 'manual') {
  if (!current?.active) return;
  if (current.finalizing) return;
  if (activeBleDraft === current) activeBleDraft = null;
  const timer = sessionTimers.get(current.sessionId);
  if (timer) window.clearTimeout(timer);
  sessionTimers.delete(current.sessionId);
  const checkpointTimer = checkpointTimers.get(current.sessionId);
  if (checkpointTimer) window.clearInterval(checkpointTimer);
  checkpointTimers.delete(current.sessionId);
  current.active = false;
  const intervals = current.aggregator.toIntervals();
  if (!intervals.length) {
    current.aggregator = null;
    current.sessionId = '';
    current.startedAt = '';
    current.finalizing = false;
    current.notice = 'Es wurden keine Werte empfangen; deshalb wurde keine Messsitzung gespeichert.';
    return;
  }
  const durationReached = Date.now() - Date.parse(current.startedAt) >= MAX_SESSION_DURATION_MS;
  current.finalizing = true;
  if (cause === 'limit' && current.source === 'ble') current.rolloverPending = true;
  current.notice = limitReached || durationReached
    ? 'Die Grenze von einer Stunde oder 3600 Sekundenintervallen wurde erreicht. Die Sitzung wird gespeichert.'
    : '';
  enqueueMeasurementCheckpoints(current, intervals, true);
  void sendCheckpointQueue(current);
}

async function stopSession(limitReached = false) {
  const current = draft.value;
  await finalizeSession(current, props.identityId, limitReached, limitReached && current?.source === 'ble' ? 'limit' : 'manual');
}

function retryUpload() {
  if (draft.value?.checkpointQueue.length) void sendCheckpointQueue(draft.value);
  else if (draft.value?.rolloverSamples.length) startNextRolloverSegment(draft.value);
  else void sendPending(draft.value, props.identityId);
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
  if (activeBleDraft?.active) void finalizeSession(activeBleDraft, activeBleDraft.ownerIdentityId);
  mounted = false;
  generation += 1;
  for (const timer of sessionTimers.values()) window.clearTimeout(timer);
  sessionTimers.clear();
  for (const timer of checkpointTimers.values()) window.clearInterval(timer);
  checkpointTimers.clear();
  window.removeEventListener('beforeunload', warnBeforeLeaving);
});

defineExpose({ acceptSample });
</script>
