<template>
  <section class="card mb-4" aria-labelledby="physician-review-title">
    <div class="card-body">
      <h3 id="physician-review-title" class="h5">Arztbereich</h3>
      <p class="small text-muted">Beantrage eine Prüfung deines Kontos als behandelnder Arzt. Eine Beantragung allein erteilt noch keine Arztberechtigung.</p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Prüfstatus wird geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
        <p class="mb-2">{{ errorMessage }}</p>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="loadReview">Erneut versuchen</button>
      </div>
      <template v-else-if="status === 'unrequested' && emailVerified">
        <p id="review-not-requested">Für dein Konto liegt noch keine Arztprüfung vor.</p>
        <p v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</p>
        <button type="button" class="btn btn-outline-primary" aria-describedby="review-not-requested" :disabled="busy" @click="requestReview">
          {{ busy ? 'Wird beantragt …' : 'Arztprüfung beantragen' }}
        </button>
      </template>
      <p v-else-if="status === 'unrequested'" role="status" aria-live="polite">
        Bestätige zuerst die E-Mail-Adresse deines Kontos, bevor du eine Arztprüfung beantragst.
      </p>
      <div v-else-if="status === 'pending'" role="status" aria-live="polite">
        <p>Deine Arztprüfung ist beantragt. Bis zur Bestätigung sind keine Arztfunktionen freigeschaltet.</p>
        <p v-if="notificationStatus === 'pending'" class="alert alert-warning" role="alert">
          Der Benachrichtigungseintrag konnte noch nicht lokal abgelegt werden. Es wurde keine E-Mail versendet. Du kannst den Versuch wiederholen.
        </p>
        <p v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</p>
        <p v-else class="small text-muted">Der Benachrichtigungseintrag liegt im lokalen privaten Mailausgang. Das bedeutet nicht, dass eine E-Mail versendet wurde.</p>
        <button v-if="notificationStatus === 'pending'" type="button" class="btn btn-outline-primary me-2" :disabled="busy" @click="retryNotification">
          {{ busy ? 'Wird erneut versucht …' : 'Benachrichtigung erneut versuchen' }}
        </button>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="loadReview">Status erneut prüfen</button>
      </div>
      <p v-else-if="status === 'approved'" role="status">Dein Arztkonto ist freigegeben. Patientenzugriff setzt eine bestätigte Zuordnung voraus.</p>
      <p v-else-if="status === 'revoked'" role="status">Die Arztfreigabe wurde entzogen. Arztfunktionen stehen nicht zur Verfügung.</p>
      <p v-if="notice" class="small text-success" role="status" aria-live="polite">{{ notice }}</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { authRequest } from './auth-api.js';

const props = defineProps({
  identityId: { type: String, required: true },
  emailVerified: { type: Boolean, default: false },
});
const emit = defineEmits(['status']);
const status = ref('loading');
const busy = ref(false);
const errorMessage = ref('');
const notice = ref('');
const notificationStatus = ref('pending');
let generation = 0;
let mounted = false;

function isCurrent(requestGeneration, identityId) {
  return mounted && requestGeneration === generation && identityId === props.identityId;
}

function clearState() {
  generation += 1;
  status.value = 'loading';
  busy.value = false;
  errorMessage.value = '';
  notice.value = '';
  notificationStatus.value = 'pending';
}

function parseReview(result) {
  if (result?.review === null) return 'unrequested';
  if (['pending', 'approved', 'revoked'].includes(result?.review?.status) && typeof result.review.requestedAt === 'string'
    && Number.isFinite(Date.parse(result.review.requestedAt))
    && ['pending', 'materialized'].includes(result.review.notificationStatus)) {
    return { status: result.review.status, notificationStatus: result.review.notificationStatus };
  }
  throw new Error('Der Kontoserver hat einen ungültigen Prüfstatus zurückgegeben.');
}

async function loadReview() {
  const requestGeneration = generation;
  const identityId = props.identityId;
  status.value = 'loading';
  busy.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const result = await authRequest('/api/physician-review');
    const review = parseReview(result);
    if (isCurrent(requestGeneration, identityId)) {
      status.value = typeof review === 'string' ? review : review.status;
      notificationStatus.value = typeof review === 'string' ? 'pending' : review.notificationStatus;
    }
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    errorMessage.value = error.message || 'Der Prüfstatus konnte nicht geladen werden.';
    status.value = 'error';
  } finally {
    if (isCurrent(requestGeneration, identityId)) busy.value = false;
  }
}

async function requestReview() {
  if (busy.value || status.value !== 'unrequested') return;
  const requestGeneration = generation;
  const identityId = props.identityId;
  busy.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const result = await authRequest('/api/physician-review', {});
    const review = parseReview(result);
    if (!isCurrent(requestGeneration, identityId)) return;
    status.value = typeof review === 'string' ? review : review.status;
    notificationStatus.value = typeof review === 'string' ? 'pending' : review.notificationStatus;
    if (status.value === 'pending') notice.value = 'Die Prüfung wurde beantragt. Sie wartet auf die zuständige Prüfung.';
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    if (error.status === 503 && error.code !== 'notification_recipient_not_configured') {
      try {
        const result = await authRequest('/api/physician-review');
        const review = parseReview(result);
        if (!isCurrent(requestGeneration, identityId)) return;
        status.value = typeof review === 'string' ? review : review.status;
        notificationStatus.value = typeof review === 'string' ? 'pending' : review.notificationStatus;
        errorMessage.value = 'Der Antrag kann bereits gespeichert sein, aber der Benachrichtigungseintrag ist noch nicht abgelegt. Bitte prüfe den Status und wiederhole den Benachrichtigungsversuch.';
        return;
      } catch (refreshError) {
        if (!isCurrent(requestGeneration, identityId)) return;
        errorMessage.value = refreshError.message || 'Der Antrag wurde möglicherweise gespeichert. Status bitte erneut laden.';
        status.value = 'error';
      }
    } else {
      errorMessage.value = error.message || 'Die Arztprüfung konnte nicht beantragt werden.';
      status.value = 'error';
    }
  } finally {
    if (isCurrent(requestGeneration, identityId)) busy.value = false;
  }
}

async function retryNotification() {
  if (busy.value || status.value !== 'pending' || notificationStatus.value !== 'pending') return;
  const requestGeneration = generation;
  const identityId = props.identityId;
  busy.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const result = await authRequest('/api/physician-review', {});
    const review = parseReview(result);
    if (!isCurrent(requestGeneration, identityId)) return;
    status.value = typeof review === 'string' ? review : review.status;
    notificationStatus.value = typeof review === 'string' ? 'pending' : review.notificationStatus;
    if (notificationStatus.value === 'materialized') {
      notice.value = 'Der Benachrichtigungseintrag wurde im lokalen privaten Mailausgang abgelegt. Es wurde keine E-Mail versendet.';
    }
  } catch (error) {
    if (!isCurrent(requestGeneration, identityId)) return;
    errorMessage.value = error.message || 'Der Benachrichtigungseintrag konnte nicht erneut abgelegt werden.';
  } finally {
    if (isCurrent(requestGeneration, identityId)) busy.value = false;
  }
}

watch(() => props.identityId, () => { clearState(); if (mounted) loadReview(); });
watch(status, value => emit('status', value), { immediate: true });
onMounted(() => { mounted = true; clearState(); loadReview(); });
onUnmounted(() => { mounted = false; generation += 1; status.value = 'loading'; busy.value = false; });
</script>
