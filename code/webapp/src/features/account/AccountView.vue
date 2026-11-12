<template>
  <section class="account-view card mx-auto" aria-labelledby="account-title" style="max-width: 38rem">
    <div class="card-body">
      <h2 id="account-title" class="h4">Dein Konto</h2>
      <p v-if="!state.identityId" class="small text-muted" id="account-scope">
        Melde dich an oder erstelle ein Konto, um dein Profil zu verwalten.
      </p>
      <p role="status" aria-live="polite">{{ statusText }}</p>
      <p v-if="callbackError" class="alert alert-danger" role="alert">{{ callbackError }}</p>
      <p v-if="state.error" class="alert alert-danger" role="alert">{{ state.error }}</p>
      <p v-if="state.notice" class="alert alert-info" role="status">{{ state.notice }}</p>

      <form v-if="mode === 'totp-login' && !state.identityId" @submit.prevent="submitTotpLogin">
        <fieldset :disabled="state.busy">
          <legend class="h5">Zwei-Faktor-Code</legend>
          <p>Gib den aktuellen Code aus deiner Authenticator-App ein, um die Anmeldung abzuschließen.</p>
          <label for="login-totp-code" class="form-label">{{ loginFactor === 'totp' ? '6-stelliger Code' : 'Wiederherstellungscode' }}</label>
          <input id="login-totp-code" v-model="loginCode" class="form-control mb-3" :inputmode="loginFactor === 'totp' ? 'numeric' : undefined"
            :autocomplete="loginFactor === 'totp' ? 'one-time-code' : 'off'" :pattern="loginFactor === 'totp' ? '[0-9]{6}' : undefined"
            :minlength="loginFactor === 'totp' ? 6 : 1" :maxlength="loginFactor === 'totp' ? 6 : 64" required />
          <button class="btn btn-primary" type="submit">{{ state.busy ? 'Bitte warten …' : 'Anmeldung bestätigen' }}</button>
          <button class="btn btn-link" type="button" @click="toggleLoginFactor">{{ loginFactor === 'totp' ? 'Wiederherstellungscode verwenden' : 'Authenticator-Code verwenden' }}</button>
          <button class="btn btn-link" type="button" @click="setMode('login')">Abbrechen</button>
        </fieldset>
      </form>
      <form v-else-if="mode === 'reset' || (!state.identityId && state.status === 'anonymous')"
        @submit.prevent="submit" :aria-describedby="mode === 'login' || mode === 'register' ? 'account-scope' : undefined">
        <fieldset :disabled="state.busy">
          <legend class="h5">{{ titles[mode] }}</legend>
          <div v-if="mode === 'register'" class="mb-3">
            <label for="account-name" class="form-label">Anzeigename</label>
            <input id="account-name" v-model="name" class="form-control" required maxlength="100" autocomplete="nickname" />
          </div>
          <div v-if="mode !== 'reset'" class="mb-3">
            <label for="account-email" class="form-label">E-Mail-Adresse</label>
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
          <p v-if="mode === 'register' || mode === 'verify'" class="small text-muted">
            Öffne den Bestätigungslink aus dem lokalen Mailausgang. Danach kannst du dich anmelden.
          </p>
          <p v-if="mode === 'reset'" class="small">Nach dem Speichern werden alle bestehenden Sitzungen beendet.</p>
          <button class="btn btn-primary mb-2" type="submit">{{ state.busy ? 'Bitte warten …' : titles[mode] }}</button>
          <div class="d-flex flex-wrap gap-1">
            <button v-if="mode !== 'login'" class="btn btn-link" type="button" @click="setMode('login')">Zur Anmeldung</button>
            <button v-if="mode === 'login'" class="btn btn-link" type="button" @click="setMode('register')">Konto erstellen</button>
            <button v-if="mode === 'login'" class="btn btn-link" type="button" @click="setMode('request-reset')">Passwort vergessen?</button>
            <button v-if="mode === 'login' || mode === 'register'" class="btn btn-link" type="button" @click="setMode('verify')">Bestätigungslink erneut anfordern</button>
          </div>
        </fieldset>
      </form>
      <div v-else-if="state.identityId">
        <section class="border rounded p-3 mb-4" aria-labelledby="two-factor-title">
          <h3 id="two-factor-title" class="h5">Zwei-Faktor-Anmeldung</h3>
          <p v-if="state.twoFactorEnabled" class="small text-muted">Aktiv. Bei jeder neuen Anmeldung ist zusätzlich ein aktueller Authenticator-Code erforderlich.</p>
          <p v-else class="small text-muted">Freiwillig: Mit einer Authenticator-App wird bei neuen Anmeldungen ein zusätzlicher Code verlangt.</p>
          <form v-if="!state.twoFactorEnabled && !totpURI" @submit.prevent="beginTwoFactorSetup">
            <label for="two-factor-password" class="form-label">Passwort zur Bestätigung</label>
            <input id="two-factor-password" v-model="twoFactorPassword" class="form-control mb-2" type="password"
              autocomplete="current-password" maxlength="128" required />
            <button class="btn btn-outline-primary" type="submit" :disabled="state.busy">Authenticator einrichten</button>
          </form>
          <div v-if="totpURI" class="mt-3">
            <p>Füge den folgenden Schlüssel in deiner Authenticator-App hinzu und bestätige mit dem angezeigten Code. Der Schlüssel ist ein Geheimnis; teile ihn nicht.</p>
            <label for="two-factor-uri" class="form-label">Einrichtungs-URI</label>
            <textarea id="two-factor-uri" class="form-control mb-3" rows="3" readonly :value="totpURI"></textarea>
            <form @submit.prevent="verifyTwoFactorSetup">
              <label for="setup-totp-code" class="form-label">6-stelliger Bestätigungscode</label>
              <input id="setup-totp-code" v-model="setupCode" class="form-control mb-2" inputmode="numeric"
                autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required />
              <button class="btn btn-primary" type="submit" :disabled="state.busy">Zwei-Faktor-Anmeldung aktivieren</button>
            </form>
          </div>
          <div v-if="recoveryCodes.length" class="alert alert-warning mt-3" role="status">
            <strong>Wiederherstellungscodes werden nur einmal angezeigt.</strong>
            <p class="small mb-1">Bewahre sie sicher und getrennt vom Gerät auf. Diese Codes werden nicht protokolliert.</p>
            <ul><li v-for="code in recoveryCodes" :key="code"><code>{{ code }}</code></li></ul>
          </div>
          <form v-if="state.twoFactorEnabled && !disableTwoFactorForm" class="mt-2" @submit.prevent="disableTwoFactorForm = true">
            <button class="btn btn-link px-0" type="submit">Zwei-Faktor-Anmeldung ausschalten</button>
          </form>
          <form v-if="disableTwoFactorForm" class="mt-2" @submit.prevent="disableTwoFactor">
            <label for="disable-two-factor-password" class="form-label">Passwort zur Bestätigung</label>
            <input id="disable-two-factor-password" v-model="twoFactorPassword" class="form-control mb-2" type="password"
              autocomplete="current-password" maxlength="128" required />
            <button class="btn btn-outline-danger" type="submit" :disabled="state.busy">Ausschalten bestätigen</button>
          </form>
        </section>
        <PatientProfile :key="state.identityId" :identity-id="state.identityId" />
        <PhysicianReview :key="`physician-${state.identityId}`" :identity-id="state.identityId" :email-verified="state.emailVerified" />
        <form class="profile-form mb-4" @submit.prevent="saveProfile">
          <div class="mb-3">
            <label for="profile-name" class="form-label">Anzeigename</label>
            <input id="profile-name" v-model="profileName" class="form-control" required maxlength="100" autocomplete="nickname" />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="state.busy || profileName.trim() === state.name">
            {{ state.busy ? 'Bitte warten …' : 'Anzeigename speichern' }}
          </button>
        </form>
        <p class="mb-3"><strong>{{ state.name || state.email }}</strong><br>{{ state.email }}<br>
          <span class="small text-muted">{{ state.emailVerified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt' }}</span>
        </p>
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { accountSession } from './session.js';
import { consumeAccountCallback } from './auth-api.js';
import PatientProfile from './PatientProfile.vue';
import PhysicianReview from './PhysicianReview.vue';

const { state } = accountSession;
const mode = ref('login');
const name = ref('');
const profileName = ref('');
const email = ref('');
const password = ref('');
const passwordRepeat = ref('');
const loginCode = ref('');
const loginFactor = ref('totp');
const setupCode = ref('');
const twoFactorPassword = ref('');
const totpURI = ref('');
const recoveryCodes = ref([]);
const disableTwoFactorForm = ref(false);
const resetToken = ref('');
const callbackError = ref('');
const titles = { login: 'Anmelden', register: 'Konto erstellen', verify: 'Bestätigungslink anfordern',
  'request-reset': 'Link zum Zurücksetzen anfordern', reset: 'Neues Passwort speichern' };
const needsPassword = computed(() => ['login', 'register', 'reset'].includes(mode.value));
const statusText = computed(() => ({ loading: 'Anmeldestatus wird geprüft …',
  authenticated: 'Du bist angemeldet.', anonymous: 'Melde dich an, um fortzufahren.',
  unavailable: 'Der aktuelle Anmeldestatus kann nicht bestätigt werden.' })[state.status]);

function clearPasswords() { password.value = ''; passwordRepeat.value = ''; }
function setMode(value) {
  mode.value = value;
  clearPasswords();
  resetToken.value = '';
  callbackError.value = '';
  accountSession.clearFeedback();
  loginCode.value = '';
  loginFactor.value = 'totp';
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
      const result = await accountSession.signIn({ email: email.value.trim(), password: password.value });
      if (result?.requiresTwoFactor) mode.value = 'totp-login';
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

async function submitTotpLogin() {
  const verified = loginFactor.value === 'totp'
    ? await accountSession.verifySignInCode(loginCode.value.trim())
    : await accountSession.verifySignInBackupCode(loginCode.value.trim());
  if (verified) {
    loginCode.value = '';
    mode.value = 'login';
  }
}

function toggleLoginFactor() {
  loginFactor.value = loginFactor.value === 'totp' ? 'backup' : 'totp';
  loginCode.value = '';
  accountSession.clearFeedback();
}

async function beginTwoFactorSetup() {
  const result = await accountSession.enableTwoFactor(twoFactorPassword.value);
  twoFactorPassword.value = '';
  if (result?.totpURI) {
    totpURI.value = result.totpURI;
    recoveryCodes.value = Array.isArray(result.backupCodes) ? result.backupCodes : [];
  }
}

async function verifyTwoFactorSetup() {
  if (await accountSession.verifyEnrollmentCode(setupCode.value.trim())) {
    setupCode.value = '';
    totpURI.value = '';
  }
}

async function disableTwoFactor() {
  if (await accountSession.disableTwoFactor(twoFactorPassword.value)) {
    twoFactorPassword.value = '';
    recoveryCodes.value = [];
    disableTwoFactorForm.value = false;
  }
}

async function saveProfile() {
  await accountSession.saveProfile(profileName.value.trim());
}

watch(() => state.name, (value) => {
  profileName.value = value;
}, { immediate: true });

watch(() => state.identityId, () => {
  // Clear authenticator material when the active account changes.
  totpURI.value = '';
  recoveryCodes.value = [];
  setupCode.value = '';
  twoFactorPassword.value = '';
  disableTwoFactorForm.value = false;
});

function handleAccountCallback() {
  const url = new URL(window.location.href);
  const callback = consumeAccountCallback(url);
  // Strip tokens before any asynchronous requests or subsequent navigation.
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  if (callback.linkError) {
    resetToken.value = '';
    mode.value = 'login';
    callbackError.value = 'Der Kontolink ist ungültig, abgelaufen oder bereits verwendet. Bitte einen neuen Link anfordern.';
  } else if (callback.resetToken) {
    callbackError.value = '';
    resetToken.value = callback.resetToken;
    mode.value = 'reset';
  }
}

onMounted(() => {
  handleAccountCallback();
  window.addEventListener('hashchange', handleAccountCallback);
  accountSession.refresh();
});
onUnmounted(() => {
  window.removeEventListener('hashchange', handleAccountCallback);
  clearPasswords();
  twoFactorPassword.value = '';
  setupCode.value = '';
  loginCode.value = '';
  loginFactor.value = 'totp';
  totpURI.value = '';
  recoveryCodes.value = [];
  resetToken.value = '';
});
</script>
