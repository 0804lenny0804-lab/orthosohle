<template>
  <section class="account-view card mx-auto" aria-labelledby="account-title" style="max-width: 38rem">
    <div class="card-body">
      <h2 id="account-title" class="h4">Dein Konto</h2>
      <p class="small text-muted" id="account-scope">
        Lokaler Testzugang. Noch keine Messdaten- oder Arztberechtigung.
      </p>
      <p role="status" aria-live="polite">{{ statusText }}</p>
      <p v-if="callbackError" class="alert alert-danger" role="alert">{{ callbackError }}</p>
      <p v-if="state.error" class="alert alert-danger" role="alert">{{ state.error }}</p>
      <p v-if="state.notice" class="alert alert-info" role="status">{{ state.notice }}</p>

      <form v-if="mode === 'reset' || (!state.identityId && state.status === 'anonymous')"
        @submit.prevent="submit" aria-describedby="account-scope">
        <fieldset :disabled="state.busy">
          <legend class="h5">{{ titles[mode] }}</legend>
          <div v-if="mode === 'register'" class="mb-3">
            <label for="account-name" class="form-label">Erfundener Anzeigename</label>
            <input id="account-name" v-model="name" class="form-control" required maxlength="100" autocomplete="nickname" />
          </div>
          <div v-if="mode !== 'reset'" class="mb-3">
            <label for="account-email" class="form-label">Test-E-Mail-Adresse</label>
            <input id="account-email" v-model="email" class="form-control" type="email" required maxlength="254" autocomplete="username" />
          </div>
          <template v-if="needsPassword">
            <div class="mb-3">
              <label for="account-password" class="form-label">{{ mode === 'reset' ? 'Neues Passwort' : 'Passwort' }}</label>
              <input id="account-password" v-model="password" class="form-control" type="password" required
                :minlength="mode === 'login' ? undefined : 8" maxlength="128"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
            </div>
            <div v-if="mode !== 'login'" class="mb-3">
              <label for="account-password-repeat" class="form-label">Passwort wiederholen</label>
              <input id="account-password-repeat" v-model="passwordRepeat" class="form-control" type="password"
                required minlength="8" maxlength="128" autocomplete="new-password" />
            </div>
          </template>
          <p v-if="mode === 'register' || mode === 'verify'" class="small">
            Den Link aus dem lokalen Mailausgang öffnen. Eine neue Anmeldung ist erst nach Bestätigung möglich.
          </p>
          <p v-if="mode === 'reset'" class="small">Nach dem Speichern werden alle bestehenden Sitzungen beendet.</p>
          <button class="btn btn-primary mb-2" type="submit">{{ state.busy ? 'Bitte warten …' : titles[mode] }}</button>
          <div class="d-flex flex-wrap gap-1">
            <button v-if="mode !== 'login'" class="btn btn-link" type="button" @click="setMode('login')">Zur Anmeldung</button>
            <button v-if="mode === 'login'" class="btn btn-link" type="button" @click="setMode('register')">Testkonto erstellen</button>
            <button v-if="mode === 'login'" class="btn btn-link" type="button" @click="setMode('request-reset')">Passwort vergessen?</button>
            <button v-if="mode === 'login' || mode === 'register'" class="btn btn-link" type="button" @click="setMode('verify')">Bestätigungslink erneut anfordern</button>
          </div>
        </fieldset>
      </form>
      <div v-else-if="state.identityId">
        <p>{{ state.email }}: {{ state.emailVerified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt' }}</p>
        <button v-if="!state.emailVerified" type="button" class="btn btn-outline-primary me-2 mb-2"
          :disabled="state.busy" @click="accountSession.resendVerification({ email: state.email })">Bestätigungslink erneut anfordern</button>
        <button type="button" class="btn btn-outline-secondary me-2 mb-2"
          :disabled="state.busy" @click="accountSession.refresh">Status erneut prüfen</button>
        <button type="button" class="btn btn-primary mb-2" :disabled="state.busy" @click="accountSession.signOut">
          {{ state.busy ? 'Bitte warten …' : 'Abmelden' }}
        </button>
      </div>
      <button v-if="state.status === 'unavailable'" class="btn btn-outline-secondary mt-3" type="button"
        :disabled="state.busy" @click="accountSession.refresh">Verbindung erneut prüfen</button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { accountSession } from './session.js';
import { consumeAccountCallback } from './auth-api.js';

const { state } = accountSession;
const mode = ref('login');
const name = ref('');
const email = ref('');
const password = ref('');
const passwordRepeat = ref('');
const resetToken = ref('');
const callbackError = ref('');
const titles = { login: 'Anmelden', register: 'Testkonto erstellen', verify: 'Bestätigungslink anfordern',
  'request-reset': 'Link zum Zurücksetzen anfordern', reset: 'Neues Passwort speichern' };
const needsPassword = computed(() => ['login', 'register', 'reset'].includes(mode.value));
const statusText = computed(() => ({ loading: 'Anmeldestatus wird geprüft …',
  authenticated: 'Du bist mit einem lokalen Testkonto angemeldet.', anonymous: 'Du bist nicht angemeldet.',
  unavailable: 'Der aktuelle Anmeldestatus kann nicht bestätigt werden.' })[state.status]);

function clearPasswords() { password.value = ''; passwordRepeat.value = ''; }
function setMode(value) {
  mode.value = value;
  clearPasswords();
  resetToken.value = '';
  callbackError.value = '';
}

async function submit() {
  callbackError.value = '';
  try {
    if (['register', 'reset'].includes(mode.value) && password.value !== passwordRepeat.value) {
      callbackError.value = 'Die Passwörter stimmen nicht überein. Bitte erneut eingeben.';
      return;
    }
    if (mode.value === 'register') {
      if (await accountSession.register({ name: name.value.trim(), email: email.value.trim(), password: password.value })) mode.value = 'login';
    } else if (mode.value === 'login') {
      await accountSession.signIn({ email: email.value.trim(), password: password.value });
    } else if (mode.value === 'verify') {
      await accountSession.resendVerification({ email: email.value.trim() });
    } else if (mode.value === 'request-reset') {
      await accountSession.requestReset({ email: email.value.trim() });
    } else if (mode.value === 'reset') {
      if (await accountSession.resetPassword({ token: resetToken.value, newPassword: password.value })) {
        resetToken.value = '';
        mode.value = 'login';
      }
    }
  } finally { clearPasswords(); }
}

function handleAccountCallback() {
  const url = new URL(window.location.href);
  const callback = consumeAccountCallback(url);
  // Strip tokens before any asynchronous requests or subsequent navigation.
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  if (callback.linkError) callbackError.value = 'Der Kontolink ist ungültig, abgelaufen oder bereits verwendet. Bitte einen neuen Link anfordern.';
  if (callback.resetToken) { resetToken.value = callback.resetToken; mode.value = 'reset'; }
}

onMounted(() => {
  handleAccountCallback();
  window.addEventListener('hashchange', handleAccountCallback);
  accountSession.refresh();
});
onUnmounted(() => {
  window.removeEventListener('hashchange', handleAccountCallback);
  clearPasswords();
  resetToken.value = '';
});
</script>
