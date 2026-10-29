<script setup>
import { ref } from "vue";
import { authClient } from "../auth-client.js";

const emit = defineEmits(["authenticated"]);
const register = ref(false);
const email = ref("");
const password = ref("");
const name = ref("");
const busy = ref(false);
const error = ref("");

async function submit() {
  busy.value = true;
  error.value = "";
  try {
    const credentials = { email: email.value, password: password.value };
    const result = register.value
      ? await authClient.signUp.email({ ...credentials, name: name.value })
      : await authClient.signIn.email(credentials);
    if (result.error) {
      error.value =
        "Anmeldung nicht möglich. Prüfe deine Angaben oder versuche es später erneut.";
      return;
    }
    password.value = "";
    emit("authenticated");
  } catch {
    error.value = "Der Anmeldedienst ist gerade nicht erreichbar.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card account" aria-labelledby="account-title">
    <h2 id="account-title">
      {{ register ? "Testkonto erstellen" : "Anmelden" }}
    </h2>
    <p>
      Lokaler Entwicklungstest. Bitte verwende ausschließlich erfundene
      Kontaktdaten und ein eigenes Testpasswort.
    </p>
    <p role="alert" v-if="error">{{ error }}</p>
    <form @submit.prevent="submit" :aria-busy="busy">
      <label v-if="register"
        >Anzeigename<input
          v-model="name"
          required
          maxlength="100"
          autocomplete="name"
      /></label>
      <label
        >E-Mail<input
          v-model="email"
          type="email"
          required
          autocomplete="username"
      /></label>
      <label
        >Passwort<input
          v-model="password"
          type="password"
          required
          minlength="12"
          maxlength="128"
          :autocomplete="register ? 'new-password' : 'current-password'"
      /></label>
      <p class="muted">
        Mindestens 12 Zeichen. Noch kein E-Mail-Versand oder Passwortreset
        eingerichtet.
      </p>
      <button :disabled="busy" type="submit">
        {{
          busy
            ? "Bitte warten …"
            : register
              ? "Testkonto erstellen"
              : "Anmelden"
        }}
      </button>
      <button
        class="secondary"
        :disabled="busy"
        type="button"
        @click="
          register = !register;
          error = '';
          password = '';
        "
      >
        {{ register ? "Zur Anmeldung" : "Neues Testkonto" }}
      </button>
    </form>
  </section>
</template>
