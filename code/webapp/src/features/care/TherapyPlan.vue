<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { careApi } from './care-api.js';
import { isValidTherapyLimit, parsePatientPlan, parsePhysicianPlans, therapyPlanApi } from './therapy-plan-api.js';

const props = defineProps({
  identityId: { type: String, required: true },
  role: { type: String, required: true, validator: value => ['physician', 'patient'].includes(value) },
});
const emit = defineEmits(['access-error']);

const status = ref('loading');
const patients = ref([]);
const patientId = ref('');
const plans = ref([]);
const currentVersion = ref(null);
const historyLoaded = ref(false);
const current = ref(null);
const confirmedAt = ref(null);
const relationship = ref(null);
const previousPlanStatus = ref(null);
const limitInput = ref('');
const busy = ref(false);
const error = ref('');
const notice = ref('');
let generation = 0;
let mounted = false;

function isCurrent(request, identity, selectedPatient = '') {
  return mounted && generation === request && props.identityId === identity && patientId.value === selectedPatient;
}

function clearData() {
  generation += 1;
  patients.value = [];
  patientId.value = '';
  plans.value = [];
  currentVersion.value = null;
  historyLoaded.value = false;
  current.value = null;
  confirmedAt.value = null;
  relationship.value = null;
  previousPlanStatus.value = null;
  limitInput.value = '';
  busy.value = false;
  error.value = '';
  notice.value = '';
  status.value = 'loading';
}

function isPatientOption(value) {
  return value && typeof value.patientId === 'string' && typeof value.displayName === 'string'
    && value.status === 'active';
}

function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function reportPhysicianAccessError(cause) {
  if (props.role === 'physician' && [401, 403, 404].includes(cause?.status)) {
    emit('access-error', { status: cause.status });
  }
}

async function load() {
  const request = generation;
  const identity = props.identityId;
  status.value = 'loading';
  busy.value = true;
  error.value = '';
  notice.value = '';
  if (!identity) {
    status.value = 'error';
    busy.value = false;
    error.value = 'Bitte melde dich an, um den Therapieplan zu sehen.';
    return;
  }
  try {
    if (props.role === 'physician') {
      const result = await careApi.listPhysicianPatients();
      if (!isCurrent(request, identity)) return;
      if (!Array.isArray(result?.patients) || !result.patients.every(isPatientOption)) throw new Error('Der Server hat eine ungültige Patientenliste zurückgegeben.');
      patients.value = result.patients;
      status.value = 'ready';
    } else {
      const result = await therapyPlanApi.getForPatient();
      if (!isCurrent(request, identity)) return;
      ({ plan: current.value, confirmedAt: confirmedAt.value, relationship: relationship.value, previousPlanStatus: previousPlanStatus.value } = parsePatientPlan(result));
      status.value = 'ready';
    }
  } catch (cause) {
    if (!isCurrent(request, identity)) return;
    error.value = cause.message || 'Der Therapieplan konnte nicht geladen werden.';
    status.value = 'error';
    reportPhysicianAccessError(cause);
  } finally {
    if (isCurrent(request, identity)) busy.value = false;
  }
}

async function selectPatient(nextPatientId) {
  if (nextPatientId === patientId.value) return;
  generation += 1;
  patientId.value = nextPatientId;
  plans.value = [];
  currentVersion.value = null;
  historyLoaded.value = false;
  limitInput.value = '';
  error.value = '';
  notice.value = '';
  if (!nextPatientId) { busy.value = false; return; }
  const request = generation;
  const identity = props.identityId;
  busy.value = true;
  try {
    const result = await therapyPlanApi.listForPhysician(nextPatientId);
    if (!isCurrent(request, identity, nextPatientId)) return;
    const history = parsePhysicianPlans(result);
    plans.value = history.plans;
    currentVersion.value = history.currentVersion;
    historyLoaded.value = true;
  } catch (cause) {
    if (!isCurrent(request, identity, nextPatientId)) return;
    error.value = cause.message || 'Die Planhistorie konnte nicht geladen werden.';
    reportPhysicianAccessError(cause);
  } finally {
    if (isCurrent(request, identity, nextPatientId)) busy.value = false;
  }
}

async function reloadHistory() {
  const selectedPatient = patientId.value;
  if (!selectedPatient || busy.value) return;
  generation += 1;
  const request = generation;
  const identity = props.identityId;
  error.value = '';
  busy.value = true;
  try {
    const result = await therapyPlanApi.listForPhysician(selectedPatient);
    if (!isCurrent(request, identity, selectedPatient)) return;
    const history = parsePhysicianPlans(result);
    plans.value = history.plans;
    currentVersion.value = history.currentVersion;
    historyLoaded.value = true;
  } catch (cause) {
    if (isCurrent(request, identity, selectedPatient)) {
      error.value = cause.message || 'Die Planhistorie konnte nicht geladen werden.';
      reportPhysicianAccessError(cause);
    }
  } finally {
    if (isCurrent(request, identity, selectedPatient)) busy.value = false;
  }
}

async function createPlan() {
  if (busy.value || !patientId.value) return;
  const value = Number(limitInput.value);
  if (!isValidTherapyLimit(value)) {
    error.value = 'Gib eine Grenze größer als 0 kg mit höchstens drei Nachkommastellen ein.';
    return;
  }
  const request = generation;
  const identity = props.identityId;
  const selectedPatient = patientId.value;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const expectedVersion = currentVersion.value;
    const result = await therapyPlanApi.createForPhysician(selectedPatient, value, expectedVersion);
    if (!isCurrent(request, identity, selectedPatient)) return;
    const created = parsePhysicianPlans({ plans: [result?.plan], currentVersion: result?.plan?.version }).plans[0];
    plans.value = [created, ...plans.value.filter(plan => plan.id !== created.id)].sort((a, b) => b.version - a.version);
    currentVersion.value = created.version;
    historyLoaded.value = true;
    limitInput.value = '';
    notice.value = `Planversion ${created.version} wurde erstellt.`;
  } catch (cause) {
    if (isCurrent(request, identity, selectedPatient)) {
      error.value = cause.status === 409
        ? 'Die Planhistorie wurde parallel geändert. Lade sie neu und prüfe die aktuelle Version.'
        : cause.message || 'Die neue Planversion konnte nicht gespeichert werden.';
      reportPhysicianAccessError(cause);
    }
  } finally {
    if (isCurrent(request, identity, selectedPatient)) busy.value = false;
  }
}

async function confirmPlan() {
  if (busy.value || !current.value || confirmedAt.value) return;
  const request = generation;
  const identity = props.identityId;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await therapyPlanApi.confirmForPatient(current.value.id);
    if (!isCurrent(request, identity)) return;
    const confirmation = result?.confirmation;
    if (confirmation?.versionId !== current.value.id || typeof confirmation.confirmedAt !== 'string'
      || !Number.isFinite(Date.parse(confirmation.confirmedAt)) || typeof confirmation.alreadyConfirmed !== 'boolean') {
      throw new Error('Der Server hat die Patientenbestätigung nicht gültig bestätigt.');
    }
    confirmedAt.value = confirmation.confirmedAt;
    notice.value = confirmation.alreadyConfirmed ? 'Diese Planversion war bereits von dir bestätigt.' : 'Du hast diese Planversion bestätigt.';
  } catch (cause) {
    if (isCurrent(request, identity)) {
      error.value = cause.message || 'Die Planversion konnte nicht bestätigt werden.';
      if (cause.status === 409) await load();
    }
  } finally {
    if (isCurrent(request, identity)) busy.value = false;
  }
}

watch(() => [props.identityId, props.role], () => { clearData(); if (mounted) void load(); });
onMounted(() => { mounted = true; clearData(); void load(); });
onUnmounted(() => { mounted = false; clearData(); });
</script>

<template>
  <section class="card mb-4" aria-labelledby="therapy-plan-title">
    <div class="card-body">
      <h3 id="therapy-plan-title" class="h5">Therapieplan und Belastungsgrenze</h3>
      <p class="small text-muted">Die Patientenbestätigung dokumentiert, dass du die angezeigte Version gesehen hast. Sie bestätigt nicht, dass ein Gerät die Grenze übernommen oder angewendet hat.</p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Therapieplan wird geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p>{{ error }}</p><button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="load">Erneut versuchen</button>
      </div>
      <template v-else-if="role === 'physician'">
        <label class="form-label" for="therapy-plan-patient">Aktiv zugeordneten Patienten auswählen</label>
        <select id="therapy-plan-patient" class="form-select mb-3" :value="patientId" :disabled="busy" @change="selectPatient($event.target.value)">
          <option value="">Patient auswählen …</option>
          <option v-for="patient in patients" :key="patient.patientId" :value="patient.patientId">{{ patient.displayName }}</option>
        </select>
        <p v-if="patients.length === 0" class="text-muted" role="status">Es sind keine aktiven Patienten zugeordnet.</p>
        <template v-if="patientId">
          <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
          <button v-if="error && error.includes('parallel geändert')" type="button" class="btn btn-outline-secondary btn-sm mb-3"
            :disabled="busy" @click="reloadHistory">Planhistorie neu laden</button>
          <form class="row g-2 align-items-end mb-3" @submit.prevent="createPlan">
            <div class="col-12 col-sm-7">
              <label class="form-label" for="therapy-plan-limit">Neue Belastungsgrenze (kg)</label>
              <input id="therapy-plan-limit" v-model="limitInput" class="form-control" type="number" min="0.001" step="0.001" inputmode="decimal" required :disabled="busy">
            </div>
            <div class="col-12 col-sm-auto"><button type="submit" class="btn btn-primary w-100" :disabled="busy">{{ busy ? 'Wird gespeichert …' : 'Neue Planversion anlegen' }}</button></div>
          </form>
          <p v-if="notice" role="status" aria-live="polite" class="text-success">{{ notice }}</p>
          <h4 class="h6">Planhistorie</h4>
          <p class="small text-muted">Bei einem Arztwechsel ist die Fortgeltung eines früheren Plans ungeklärt. Diese Historie bestätigt keine aktuelle Gültigkeit.</p>
          <p v-if="busy && plans.length === 0" role="status">Planhistorie wird geladen …</p>
          <p v-else-if="historyLoaded && plans.length === 0" class="text-muted" role="status">Für diesen Patienten ist noch kein Therapieplan vorhanden.</p>
          <ol v-else class="list-group list-group-numbered">
            <li v-for="plan in plans" :key="plan.id" class="list-group-item d-flex flex-column flex-sm-row justify-content-between gap-1">
              <span><strong>Version {{ plan.version }} · {{ plan.limitKg }} kg</strong><span v-if="plan.version === currentVersion" class="badge text-bg-primary ms-2">Aktuelle Beziehungsversion</span></span>
              <span class="small text-muted">Erstellt von {{ plan.authorName }} · {{ formatDate(plan.createdAt) }}</span>
            </li>
          </ol>
        </template>
      </template>
      <template v-else>
        <p v-if="previousPlanStatus === 'continuation_undetermined'" class="alert alert-warning" role="status">
          Für die frühere Planversion ist die Fortgeltung ungeklärt. Es wird kein aktueller Plan für die neue Betreuungszuordnung angezeigt.
        </p>
        <p v-if="relationship && (relationship.status !== 'active' || relationship.physicianApprovalStatus !== 'approved')" class="alert alert-warning" role="status">
          Es liegt derzeit keine freigegebene aktive Betreuungszuordnung vor. Ein früherer Plan wird nicht als aktuell angezeigt.
        </p>
        <p v-if="!current" class="text-muted" role="status">Für dein Konto ist derzeit kein aktueller Therapieplan hinterlegt.</p>
        <template v-else>
          <p class="mb-1">Aktuelle Planversion <strong>{{ current.version }}</strong></p>
          <p class="display-6">{{ current.limitKg }} kg</p>
          <p class="small text-muted">Erstellt von {{ current.authorName }} am {{ formatDate(current.createdAt) }}</p>
          <p v-if="confirmedAt" class="text-success" role="status">Von dir am {{ formatDate(confirmedAt) }} bestätigt.</p>
          <div v-else class="alert alert-info" role="note">
            <p>Diese Planversion ist noch nicht von dir bestätigt.</p>
            <button type="button" class="btn btn-primary" :disabled="busy" @click="confirmPlan">{{ busy ? 'Wird bestätigt …' : 'Ich habe diese Planversion gelesen' }}</button>
          </div>
        </template>
        <div v-if="error" class="alert alert-danger" role="alert">{{ error }} <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="load">Erneut laden</button></div>
        <p v-if="notice" role="status" aria-live="polite" class="text-success">{{ notice }}</p>
      </template>
    </div>
  </section>
</template>
