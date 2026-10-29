<script setup>
import { onMounted, ref } from "vue";
import { authClient } from "./auth-client.js";
import AccountAccess from "./components/AccountAccess.vue";
const account = ref(null);
const checking = ref(true);
const accountError = ref("");
async function checkSession() {
  checking.value = true;
  accountError.value = "";
  try {
    const result = await authClient.getSession();
    if (result.error) throw new Error("Session unavailable");
    account.value = result.data?.user ?? null;
  } catch {
    account.value = null;
    accountError.value = "Die Anmeldung konnte nicht geprüft werden.";
  } finally {
    checking.value = false;
  }
}
async function signOut() {
  accountError.value = "";
  try {
    const result = await authClient.signOut();
    if (result.error) throw new Error("Logout failed");
    account.value = null;
  } catch {
    accountError.value = "Abmeldung fehlgeschlagen. Bitte erneut versuchen.";
  }
}
onMounted(checkSession);
import TherapyPlan from "./components/TherapyPlan.vue";
import DeviceStatus from "./components/DeviceStatus.vue";
import SessionHistory from "./components/SessionHistory.vue";
</script>

<template>
  <a class="skip" href="#main">Zum Inhalt</a>
  <header>
    <a class="brand" href="/" aria-label="OrthoSohle Startseite"
      ><span class="mark" aria-hidden="true">O</span>OrthoSohle</a
    ><span class="badge">Lokale Entwicklung</span>
  </header>
  <main id="main">
    <div class="eyebrow">MEIN ÜBERBLICK</div>
    <h1>Deine Belastung im Blick.</h1>
    <p class="intro">Therapieplan und Gerätestatus an einem Ort.</p>
    <aside class="notice">
      Entwicklungsstand mit synthetischen Daten. Lokale Testkonten sind
      angebunden; echte Messungen und Arztberechtigungen fehlen noch.
    </aside>
    <p v-if="checking" role="status">Anmeldung wird geprüft …</p>
    <p v-if="accountError" role="alert">
      {{ accountError }} <button @click="checkSession">Erneut prüfen</button>
    </p>
    <AccountAccess v-if="!checking && !account" @authenticated="checkSession" />
    <template v-if="account">
      <p>
        Angemeldet als {{ account.name }}
        <button class="secondary" @click="signOut">Abmelden</button>
      </p>
      <section class="grid" aria-label="Plan und Verbindung">
        <TherapyPlan />
        <DeviceStatus />
      </section>
      <SessionHistory />
    </template>
    <footer>
      OrthoSohle · Webapp-Grundlage · Keine aktive Messung oder Warnfunktion
    </footer>
  </main>
</template>
