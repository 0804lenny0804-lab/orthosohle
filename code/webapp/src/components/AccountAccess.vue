<script setup>
import PasswordRecovery from "./PasswordRecovery.vue";
import { ref } from "vue";
import { authClient } from "../auth-client.js";

const emit = defineEmits(["authenticated"]);
const register = ref(false);
const email = ref("");
const password = ref("");
const name = ref("");
const busy = ref(false);
const error = ref("");
const notice = ref("");

async function submit() {
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const credentials = { email: email.value, password: password.value };
    const result = register.value
      ? await authClient.signUp.email({ ...credentials, name: name.value })
      : await authClient.signIn.email(credentials);
    if (result.error) {
      error.value =
        "Anmeldung nicht möglich. Prüfe deine Angaben und bestätige zuerst deine E-Mail-Adresse.";
      return;
    }
    password.value = "";
    if (register.value) {
      notice.value =
        "Testkonto angelegt. Öffne den Bestätigungslink aus der lokalen Mailablage, bevor du dich anmeldest.";
      register.value = false;
    } else {
      emit("authenticated");
    }
  } catch {
    error.value = "Der Anmeldedienst ist gerade nicht erreichbar.";
  } finally {
    busy.value = false;
  }
}
async function resendVerification() {
  if (!email.value) {
    error.value = "Bitte gib zuerst deine E-Mail-Adresse ein.";
    return;
  }
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await authClient.sendVerificationEmail({
      email: email.value,
      callbackURL: "/",
    });
    if (result.error) throw new Error("verification failed");
    notice.value =
      "Falls eine Bestätigung erforderlich ist, wurde ein Link in der lokalen Testablage erstellt.";
  } catch {
    error.value =
      "Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es später erneut.";
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
    <p v-if="notice" role="status">{{ notice }}</p>
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
        Mindestens 12 Zeichen. Bestätigung und Rücksetzen erfolgen über die
        lokale Mail-Testablage.
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
    <button class="secondary" :disabled="busy" @click="resendVerification">
      Bestätigungslink erneut anfordern
    </button>
    <PasswordRecovery />
  </section>
</template>
