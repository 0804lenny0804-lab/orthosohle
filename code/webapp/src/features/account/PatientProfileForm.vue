<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { careApi } from '../care/care-api.js';
import { patientProfileFormApi, parseEditableProfile } from './patient-profile-form-api.js';

const props = defineProps({
  identityId: { type: String, required: true },
  role: { type: String, default: 'patient', validator: value => ['patient', 'physician'].includes(value) },
});
const emit = defineEmits(['access-error']);
const status = ref('loading');
const patients = ref([]);
const patientId = ref('');
const profileId = ref('');
const version = ref(null);
const injury = ref('');
const weightKg = ref('');
const dirty = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const conflict = ref(false);
const missing = ref(false);
const lastChangedBy = ref(null);
const formIdPrefix = `patient-profile-${props.role}`;
let generation = 0;
let mounted = false;

function current(request, identity, selected = '') {
  return mounted && generation === request && props.identityId === identity && patientId.value === selected;
}
function clear() {
  generation++;
  status.value = 'loading'; patients.value = []; patientId.value = ''; profileId.value = ''; version.value = null;
  injury.value = ''; weightKg.value = ''; dirty.value = false; busy.value = false; error.value = ''; notice.value = ''; conflict.value = false; missing.value = false; lastChangedBy.value = null;
}
function validPatient(value) { return value && typeof value.patientId === 'string' && typeof value.displayName === 'string' && value.status === 'active'; }
function applyProfile(profile) {
  if (!profile) { missing.value = true; profileId.value = ''; version.value = null; return; }
  missing.value = false;
  profileId.value = profile.id; version.value = profile.version;
  lastChangedBy.value = profile.lastChangedBy?.name || null;
  injury.value = profile.injury || ''; weightKg.value = profile.weightKg == null ? '' : String(profile.weightKg);
  dirty.value = false; conflict.value = false;
}
async function load() {
  const req = ++generation, identity = props.identityId, selected = patientId.value;
  status.value = 'loading'; busy.value = true; error.value = ''; notice.value = '';
  try {
    if (props.role === 'physician') {
      if (!patients.value.length) {
        const result = await careApi.listPhysicianPatients();
        if (!current(req, identity, selected)) return;
        if (!Array.isArray(result?.patients) || !result.patients.every(validPatient)) throw new Error('Die Patientenliste ist ungültig.');
        patients.value = result.patients;
        status.value = 'ready'; busy.value = false;
        return;
      }
      if (!selected) { status.value = 'ready'; busy.value = false; return; }
    }
    const result = await patientProfileFormApi.get(props.role, selected);
    if (!current(req, identity, selected)) return;
    const profile = parseEditableProfile(result);
    applyProfile(profile);
    status.value = 'ready';
  } catch (cause) {
    if (!current(req, identity, selected)) return;
    error.value = cause.message || 'Das Patientenprofil konnte nicht geladen werden.'; status.value = 'error';
    if (props.role === 'physician' && [401, 403, 404].includes(cause.status)) emit('access-error', { status: cause.status });
  } finally { if (current(req, identity, selected)) busy.value = false; }
}
async function selectPatient(next) {
  if (next === patientId.value) return;
  patientId.value = next; profileId.value = ''; version.value = null; injury.value = ''; weightKg.value = ''; dirty.value = false; conflict.value = false;
  if (!next) { generation++; status.value = 'ready'; busy.value = false; error.value = ''; return; }
  await load();
}
function markDirty() { dirty.value = true; conflict.value = false; }
async function save() {
  if (busy.value || !dirty.value || conflict.value || version.value === null) return;
  const normalizedInjury = injury.value.trim();
  let weight = null;
  const rawWeight = String(weightKg.value ?? '').trim();
  if (rawWeight !== '') {
    weight = Number(rawWeight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1_000) { error.value = 'Gewicht muss eine positive Zahl bis 1000 kg sein. Die Grenze ist technisch und keine klinische Bewertung.'; return; }
  }
  if (normalizedInjury.length > 240) { error.value = 'Die Verletzungsangabe darf höchstens 240 Zeichen enthalten.'; return; }
  if (normalizedInjury && normalizedInjury.length < 1) { error.value = 'Gib eine kurze Verletzungsangabe ein oder lass das Feld leer.'; return; }
  const payload = { expectedVersion: version.value, injury: normalizedInjury || null, weightKg: weight };
  const req = generation, identity = props.identityId, selected = patientId.value;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const result = await patientProfileFormApi.patch(props.role, selected, payload);
    if (!current(req, identity, selected)) return;
    applyProfile(parseEditableProfile(result)); notice.value = 'Angaben gespeichert.';
  } catch (cause) {
    if (!current(req, identity, selected)) return;
    if (cause.status === 409) { conflict.value = true; error.value = 'Das Profil wurde inzwischen geändert. Lade den aktuellen Stand neu, bevor du weiter speicherst.'; }
    else { error.value = cause.message || 'Die Angaben konnten nicht gespeichert werden.'; }
    if (props.role === 'physician' && [401, 403, 404].includes(cause.status)) emit('access-error', { status: cause.status });
  } finally { if (current(req, identity, selected)) busy.value = false; }
}
watch(() => [props.identityId, props.role], () => { clear(); if (mounted) void load(); });
onMounted(() => { mounted = true; clear(); void load(); });
onUnmounted(() => { mounted = false; clear(); });
</script>

<template>
  <section class="card mb-4" :aria-labelledby="`${formIdPrefix}-title`">
    <div class="card-body">
      <h3 :id="`${formIdPrefix}-title`" class="h5">{{ role === 'physician' ? 'Patientenangaben' : 'Deine Patientenangaben' }}</h3>
      <p class="small text-muted">Erfasse Verletzungsangaben als kurze Notiz. Das optionale Gewicht dient nur der Dokumentation. 1000 kg ist eine technische Eingabegrenze, keine klinische Bewertung. Eine Belastungsgrenze wird im Therapieplan festgelegt.</p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Patientenangaben werden geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p>{{ error }}</p><button class="btn btn-outline-secondary" type="button" :disabled="busy" @click="load">Erneut versuchen</button>
      </div>
      <div v-if="status === 'ready' && role === 'patient' && missing" class="alert alert-info" role="status">
        <p>Das eigene Patientenprofil ist noch nicht eingerichtet. Richte es zuerst im Patientenbereich ein und lade danach diese Angaben neu.</p>
        <button class="btn btn-outline-secondary" type="button" :disabled="busy" @click="load">Erneut laden</button>
      </div>
      <template v-if="status === 'ready' && role === 'physician'">
        <label class="form-label" :for="`${formIdPrefix}-select`">Aktiv zugeordneten Patienten auswählen</label>
        <select :id="`${formIdPrefix}-select`" class="form-select mb-3" :value="patientId" :disabled="busy" @change="selectPatient($event.target.value)">
          <option value="">Patient auswählen …</option><option v-for="patient in patients" :key="patient.patientId" :value="patient.patientId">{{ patient.displayName }}</option>
        </select>
        <p v-if="patients.length === 0" class="text-muted" role="status">Es sind keine aktiven Patienten zugeordnet. Eine Zuordnung erfolgt über den bestehenden Einladungs- und Annahmeablauf.</p>
      </template>
      <p v-if="status === 'ready' && role === 'physician' && patientId && missing" class="text-muted" role="status">Für diesen Patienten ist noch kein Profil eingerichtet.</p>
      <form v-if="status === 'ready' && !missing && (role === 'patient' || patientId && profileId)" @submit.prevent="save">
        <label class="form-label" :for="`${formIdPrefix}-injury`">{{ role === 'physician' ? 'Verletzung (kurze Notiz)' : 'Deine Verletzung (kurze Notiz)' }}</label>
        <textarea :id="`${formIdPrefix}-injury`" v-model="injury" class="form-control mb-3" maxlength="240" rows="3" :disabled="busy || conflict" @input="markDirty" />
        <label class="form-label" :for="`${formIdPrefix}-weight`">{{ role === 'physician' ? 'Gewicht (kg, optional)' : 'Dein Gewicht (kg, optional)' }}</label>
        <input :id="`${formIdPrefix}-weight`" v-model="weightKg" class="form-control mb-3" type="number" min="0.001" max="1000" step="any" inputmode="decimal" :disabled="busy || conflict" @input="markDirty">
        <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
        <button v-if="conflict" type="button" class="btn btn-outline-secondary" :disabled="busy" @click="load">Aktuellen Stand neu laden</button>
        <button v-else type="submit" class="btn btn-primary" :disabled="busy || !dirty">{{ busy ? 'Wird gespeichert …' : 'Angaben speichern' }}</button>
        <p v-if="notice" class="small text-success mt-2" role="status" aria-live="polite">{{ notice }}</p>
        <p v-if="lastChangedBy" class="small text-muted mt-2">Zuletzt geändert von {{ lastChangedBy }}.</p>
      </form>
    </div>
  </section>
</template>
