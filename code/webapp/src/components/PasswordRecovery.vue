<script setup>
import { ref } from "vue";
import { authClient } from "../auth-client.js";

const url = new URL(window.location.href);
const token = ref(url.searchParams.get("token") ?? "");
const hasResetLink = url.searchParams.has("reset");
if (hasResetLink || token.value) {
  // Linkgeheimnis nach Übernahme aus Adresszeile und Browserhistorie entfernen.
  window.history.replaceState(null, "", url.pathname);
}
const expanded = ref(hasResetLink);
const email = ref("");
const password = ref("");
const busy = ref(false);
const message = ref("");

async function submit() {
  busy.value = true;
  message.value = "";
  try {
    if (token.value) {
      const result = await authClient.resetPassword({
        token: token.value,
        newPassword: password.value,
      });
      if (result.error) throw new Error("reset failed");
      token.value = "";
      password.value = "";
      message.value = "Passwort geändert. Du kannst dich jetzt neu anmelden.";
    } else {
      const result = await authClient.requestPasswordReset({
        email: email.value,
        redirectTo: window.location.origin + "/?reset=1",
      });
      if (result.error) throw new Error("request failed");
      message.value =
        "Falls ein passendes Konto existiert, wurde eine Nachricht in der lokalen Testablage erstellt.";
    }
  } catch {
    message.value =
      "Zurücksetzen nicht möglich. Der Link kann ungültig oder abgelaufen sein. Bitte versuche es erneut oder fordere einen neuen Link an.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <details :open="expanded">
    <summary>Passwort vergessen?</summary>
    <p v-if="hasResetLink && !token && !message">
      Der Rücksetzlink enthält keinen gültigen Token. Bitte fordere einen neuen
      Link an.
    </p>
    <form @submit.prevent="submit" :aria-busy="busy">
      <label v-if="token"
        >Neues Passwort<input
          v-model="password"
          type="password"
          required
          minlength="12"
          maxlength="128"
          autocomplete="new-password"
      /></label>
      <label v-else
        >E-Mail<input
          v-model="email"
          type="email"
          required
          autocomplete="username"
      /></label>
      <button :disabled="busy">
        {{
          busy
            ? "Bitte warten …"
            : token
              ? "Passwort ändern"
              : "Rücksetzlink anfordern"
        }}
      </button>
      <p v-if="message" role="status">{{ message }}</p>
    </form>
  </details>
</template>
