<template>
  <section class="mb-4" aria-labelledby="password-change-title">
    <h3 id="password-change-title" class="h5">Passwort ändern</h3>
    <p class="small text-muted">Nach der Änderung bleiben nur diese Anmeldung und ihre Sitzung aktiv.</p>
    <form @submit.prevent="submit">
      <div class="mb-3">
        <label for="current-password" class="form-label">Aktuelles Passwort</label>
        <input id="current-password" v-model="currentPassword" class="form-control" type="password" autocomplete="current-password" maxlength="128" required />
      </div>
      <div class="mb-3">
        <label for="new-password" class="form-label">Neues Passwort</label>
        <input id="new-password" v-model="newPassword" class="form-control" type="password" autocomplete="new-password" minlength="8" maxlength="128" required />
      </div>
      <div class="mb-3">
        <label for="repeat-password" class="form-label">Neues Passwort wiederholen</label>
        <input id="repeat-password" v-model="repeatPassword" class="form-control" type="password" autocomplete="new-password" minlength="8" maxlength="128" required />
      </div>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <p v-if="notice" class="alert alert-info" role="status">{{ notice }}</p>
      <button class="btn btn-outline-primary" type="submit" :disabled="busy">{{ busy ? 'Bitte warten …' : 'Passwort ändern' }}</button>
    </form>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { authRequest } from './auth-api.js';

const props = defineProps({ active: { type: Boolean, default: true } });

const currentPassword = ref('');
const newPassword = ref('');
const repeatPassword = ref('');
const busy = ref(false);
const error = ref('');
const notice = ref('');

function clearPasswordFields() {
  currentPassword.value = '';
  newPassword.value = '';
  repeatPassword.value = '';
}

watch(() => props.active, active => {
  if (!active) clearPasswordFields();
});

async function submit() {
  if (busy.value) return;
  error.value = '';
  notice.value = '';
  busy.value = true;
  try {
    if (newPassword.value !== repeatPassword.value) {
      error.value = 'Die neuen Passwörter stimmen nicht überein.';
      return;
    }
    await authRequest('/api/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: true,
    });
    notice.value = 'Passwort geändert. Diese Anmeldung bleibt aktiv; andere Sitzungen wurden beendet.';
  } catch (requestError) {
    error.value = requestError.code === 'INVALID_PASSWORD'
      ? 'Das aktuelle Passwort ist falsch.'
      : requestError.message;
  } finally {
    clearPasswordFields();
    busy.value = false;
  }
}
</script>
