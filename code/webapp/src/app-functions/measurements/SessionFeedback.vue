<template>
  <section v-if="sessionId" class="card mt-3" aria-labelledby="feedback-title">
    <div class="card-body">
      <h2 id="feedback-title" class="h5">Wie hast du dich beim Lauf gefühlt?</h2>
      <form v-if="loaded" @submit.prevent="submit">
        <fieldset :disabled="busy">
          <legend class="form-label">Wohlbefinden</legend>
          <div class="d-flex flex-wrap gap-3 mb-3">
            <label v-for="choice in choices" :key="choice.value"><input v-model="rating" type="radio" name="session-feedback" :value="choice.value" required /> {{ choice.label }}</label>
          </div>
          <label class="form-label" for="session-feedback-comment">Kommentar (optional)</label>
          <textarea id="session-feedback-comment" v-model.trim="comment" class="form-control mb-3" maxlength="500" rows="3"></textarea>
          <button class="btn btn-primary me-2" type="submit">{{ busy ? 'Wird gespeichert …' : 'Feedback speichern' }}</button>
          <button class="btn btn-link" type="button" @click="dismiss">Überspringen</button>
        </fieldset>
      </form>
      <p v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</p>
      <div v-if="!loaded && !busy"><button type="button" class="btn btn-outline-primary me-2" @click="loadFeedback">Erneut laden</button><button type="button" class="btn btn-link" @click="dismiss">Überspringen</button></div>
    </div>
  </section>
</template>
<script setup>
import { ref, watch } from 'vue';
import { authRequest } from '../account/account-api.js';
const props = defineProps({ sessionId: { type: String, default: '' }, identityId: { type: String, default: '' } });
const emit = defineEmits(['dismiss']);
const choices = [{ value: 'good', label: 'Gut' }, { value: 'medium', label: 'Mittel' }, { value: 'bad', label: 'Schlecht' }];
const rating = ref(''), comment = ref(''), busy = ref(false), error = ref(''), version = ref(null), loaded = ref(false);
let generation = 0;
watch(() => [props.sessionId, props.identityId], () => { void loadFeedback(); }, { immediate: true });
async function loadFeedback() {
  const sessionId = props.sessionId, identityId = props.identityId, request = ++generation;
  rating.value = ''; comment.value = ''; error.value = ''; version.value = null; busy.value = false; loaded.value = false;
  if (!sessionId || !identityId) return;
  busy.value = true;
  try {
    const result = await authRequest(`/api/measurement-feedback/${encodeURIComponent(sessionId)}`);
    if (request !== generation) return;
    if (result.feedback) { rating.value = result.feedback.rating; comment.value = result.feedback.comment || ''; version.value = result.feedback.version; }
    loaded.value = true;
  } catch { if (request === generation) error.value = 'Das Feedback konnte nicht geladen werden.'; }
  finally { if (request === generation) busy.value = false; }
}
function dismiss() { generation++; rating.value = ''; comment.value = ''; emit('dismiss'); }
async function submit() {
  if (!props.sessionId || !props.identityId || !rating.value || busy.value) return;
  const request = generation, sessionId = props.sessionId;
  busy.value = true; error.value = '';
  try {
    await authRequest(`/api/measurement-feedback/${encodeURIComponent(sessionId)}`, { rating: rating.value, comment: comment.value || null, expectedVersion: version.value });
    if (request === generation && sessionId === props.sessionId) dismiss();
  } catch (cause) {
    if (request === generation) error.value = cause.message || 'Das Feedback konnte nicht gespeichert werden. Bitte erneut versuchen.';
  } finally { if (request === generation) busy.value = false; }
}
</script>
