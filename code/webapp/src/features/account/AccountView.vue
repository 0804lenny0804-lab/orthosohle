<template>
  <section class="card mx-auto" aria-labelledby="account-title" style="max-width: 36rem">
    <div class="card-body">
      <h2 id="account-title" class="h4">Konto</h2>
      <p class="alert alert-warning" id="account-scope">
        Lokale Testkonten: Bitte ausschließlich erfundene Angaben verwenden.
        Diese Anmeldung schützt noch keine Messdaten. Bestätigungslinks werden nur lokal abgelegt; echte E-Mails, Google-Login und Arztzugang folgen später.
      </p>
      <p role="status" aria-live="polite">{{ statusText }}</p>
      <p v-if="callbackError" class="alert alert-danger" role="alert">{{ callbackError }}</p>
      <p v-if="state.error" class="alert alert-danger" role="alert">{{ state.error }}</p>
      <p v-if="state.notice" class="alert alert-info" role="status">{{ state.notice }}</p>

      <div v-if="state.identityId">
        <p>{{ state.email }}: {{ state.emailVerified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt' }}</p>
        <p v-if="!state.emailVerified" class="small">
          Öffne den Bestätigungslink aus dem lokalen Test-Mailausgang und prüfe danach deinen Status erneut.
          Dies bestätigt noch keine Arztberechtigung oder Messdatenfreigabe.
        </p>
        <button v-if="!state.emailVerified" type="button" class="btn btn-outline-primary me-2 mb-2"
          :disabled="state.busy" @click="accountSession.resendVerification">Bestätigungslink erneut anfordern</button>
        <button type="button" class="btn btn-outline-secondary me-2 mb-2"
          :disabled="state.busy" @click="accountSession.refresh">Status erneut prüfen</button>
        <button type="button" class="btn btn-primary" :disabled="state.busy" @click="accountSession.signOut">
          {{ state.busy ? 'Bitte warten …' : 'Abmelden' }}
        </button>
      </div>
      <form v-else-if="state.status === 'anonymous'" @submit.prevent="submit" aria-describedby="account-scope">
        <fieldset :disabled="state.busy">
          <legend class="h5">{{ registering ? 'Testkonto erstellen' : 'Anmelden' }}</legend>
          <div v-if="registering" class="mb-3">
            <label for="account-name" class="form-label">Erfundener Anzeigename</label>
            <input id="account-name" v-model="name" class="form-control" required maxlength="100" autocomplete="nickname" />
          </div>
          <div class="mb-3">
            <label for="account-email" class="form-label">Test-E-Mail-Adresse</label>
            <input id="account-email" v-model="email" class="form-control" type="email" required autocomplete="username" />
          </div>
          <div class="mb-3">
            <label for="account-password" class="form-label">Passwort</label>
            <input id="account-password" v-model="password" class="form-control" type="password" required
              :minlength="registering ? 8 : undefined" maxlength="128"
              :autocomplete="registering ? 'new-password' : 'current-password'" />
          </div>
          <button class="btn btn-primary" type="submit">
            {{ state.busy ? 'Bitte warten …' : registering ? 'Testkonto erstellen' : 'Anmelden' }}
          </button>
          <button class="btn btn-link" type="button" @click="toggleMode">
            {{ registering ? 'Zur Anmeldung' : 'Neues Testkonto erstellen' }}
          </button>
        </fieldset>
      </form>
      <button v-if="state.status === 'unavailable'" class="btn btn-outline-secondary mt-3" type="button"
        :disabled="state.busy" @click="accountSession.refresh">Verbindung erneut prüfen</button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { accountSession } from './session.js';
import { consumeVerificationError } from './auth-api.js';

const { state } = accountSession;
const registering = ref(false);
const name = ref('');
const email = ref('');
const password = ref('');
const callbackError = ref('');
const statusText = computed(() => ({
  loading: 'Anmeldestatus wird geprüft …',
  authenticated: 'Du bist mit einem lokalen Testkonto angemeldet.',
  anonymous: 'Du bist nicht angemeldet.',
  unavailable: 'Der aktuelle Anmeldestatus kann nicht bestätigt werden.',
})[state.status]);

function toggleMode() {
  registering.value = !registering.value;
  password.value = '';
}

async function submit() {
  try {
    if (registering.value) {
      await accountSession.register({ name: name.value.trim(), email: email.value.trim(), password: password.value });
    } else {
      await accountSession.signIn({ email: email.value.trim(), password: password.value });
    }
  } finally {
    password.value = '';
  }
}

onMounted(() => {
  const url = new URL(window.location.href);
  if (consumeVerificationError(url)) {
    callbackError.value = 'Der Bestätigungslink ist ungültig, abgelaufen oder bereits verwendet. Bitte einen neuen Link anfordern.';
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  accountSession.refresh();
});
</script>
