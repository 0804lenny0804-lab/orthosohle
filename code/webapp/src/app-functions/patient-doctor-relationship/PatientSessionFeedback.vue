<template>
  <section aria-label="Rückmeldung zur Messung" class="mt-3">
    <h4 class="h6">Rückmeldung</h4>
    <p v-if="loading" role="status">Rückmeldung wird geladen …</p>
    <p v-else-if="error" class="text-danger" role="alert">{{ error }}</p>
    <p v-else-if="feedback">{{ labels[feedback.rating] || 'Nicht verfügbar' }}<span v-if="feedback.comment"> · {{ feedback.comment }}</span></p>
    <p v-else class="text-muted">Keine Rückmeldung vorhanden.</p>
  </section>
</template>
<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { authRequest } from '../account/account-api.js';
const props = defineProps({ identityId: { type: String, required: true }, patientId: { type: String, required: true }, sessionId: { type: String, required: true } });
const emit = defineEmits(['access-error']);
const labels = { good: 'Gut', medium: 'Mittel', bad: 'Schlecht' };
const feedback = ref(null), loading = ref(false), error = ref('');
let generation = 0;
watch(() => [props.identityId, props.patientId, props.sessionId], async ([identity, patient, session]) => {
  const request = ++generation;
  feedback.value = null; error.value = ''; loading.value = false;
  if (!identity || !patient || !session) return;
  loading.value = true;
  try {
    const result = await authRequest(`/api/measurement-feedback/physician/patients/${encodeURIComponent(patient)}/measurement-sessions/${encodeURIComponent(session)}`);
    if (request === generation) feedback.value = result.feedback;
  } catch (cause) {
    if (request !== generation) return;
    if ([401, 403, 404].includes(cause.status)) emit('access-error', { status: cause.status });
    else error.value = 'Die Rückmeldung konnte nicht geladen werden.';
  } finally { if (request === generation) loading.value = false; }
}, { immediate: true });
onUnmounted(() => { generation++; });
</script>
