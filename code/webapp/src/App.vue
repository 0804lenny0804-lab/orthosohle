<script setup>
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
      Entwicklungsstand mit synthetischen Daten. Konten und echte Messungen sind
      noch nicht angebunden.
    </aside>
    <section class="grid" aria-label="Plan und Verbindung">
      <TherapyPlan />
      <DeviceStatus />
    </section>
    <SessionHistory />
    <footer>
      OrthoSohle · Webapp-Grundlage · Keine aktive Messung oder Warnfunktion
    </footer>
  </main>
</template>
