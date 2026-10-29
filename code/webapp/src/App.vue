<script setup>
import { onMounted, ref } from 'vue';
import { loadPlan } from './api.js';
const result = ref(null);
const loading = ref(true);
const error = ref('');
async function refresh() {
  loading.value = true;
  error.value = '';
  result.value = null;
  try { result.value = await loadPlan(); }
  catch { error.value = 'Der Therapieplan ist gerade nicht verfügbar. Bitte prüfe die Verbindung und versuche es erneut.'; }
  finally { loading.value = false; }
}
onMounted(refresh);
</script>

<template>
  <a class="skip" href="#main">Zum Inhalt</a>
  <header><a class="brand" href="/" aria-label="OrthoSohle Startseite"><span class="mark" aria-hidden="true">O</span>OrthoSohle</a><span class="badge">Lokale Entwicklung</span></header>
  <main id="main">
    <div class="eyebrow">MEIN ÜBERBLICK</div>
    <h1>Deine Belastung im Blick.</h1>
    <p class="intro">Therapieplan und Gerätestatus an einem Ort.</p>
    <aside class="notice">Entwicklungsstand mit synthetischen Daten. Konten und echte Messungen sind noch nicht angebunden.</aside>
    <section class="grid" aria-label="Plan und Verbindung">
      <article class="card plan" :aria-busy="loading">
        <div class="card-top"><h2>Dein Therapieplan</h2><span v-if="result?.source === 'demo'" class="badge">Demo</span></div>
        <p v-if="loading" role="status">Plan wird geladen …</p>
        <div v-else-if="error" role="alert"><p>{{ error }}</p><button @click="refresh">Erneut versuchen</button></div>
        <template v-else-if="result?.plan">
          <p class="label">Vorgegebene Belastungsgrenze · Testwert</p>
          <p class="weight">{{ result.plan.limitKg }} <span>kg</span></p>
          <p>Planversion {{ result.plan.version }} · synthetischer Beispielplan</p>
          <div class="status">Nicht auf einem Gerät angewendet</div>
          <p class="muted">Die medizinische Grenze wird künftig durch deinen behandelnden Arzt festgelegt.</p>
        </template>
        <template v-else><h3>Noch kein Therapieplan</h3><p>Es ist kein ärztlicher Plan hinterlegt. Ein fehlender Plan ist keine Freigabe für eine Belastung.</p></template>
      </article>
      <article class="card"><div class="card-top"><h2>Dein Gerät</h2><span class="dot" aria-hidden="true"></span></div><h3>Kein Gerät verbunden</h3><p>Es werden keine aktuellen Messwerte empfangen.</p><dl><div><dt>Aktuelle Belastung</dt><dd>Nicht verfügbar</dd></div><div><dt>Letzte Messung</dt><dd>Noch keine</dd></div><div><dt>Grenzwertübernahme</dt><dd>Nicht bestätigt</dd></div></dl></article>
    </section>
    <section class="card sessions"><div class="card-top"><h2>Deine Messsitzungen</h2><span class="muted">0 Sitzungen</span></div><div class="empty"><h3>Hier beginnt dein Verlauf.</h3><p>Sobald Geräte und Sitzungsaufzeichnung angebunden sind, findest du hier deine Messungen.</p></div></section>
    <footer>OrthoSohle · Webapp-Grundlage · Keine aktive Messung oder Warnfunktion</footer>
  </main>
</template>
