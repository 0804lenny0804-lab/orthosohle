<script setup>
import { onMounted, ref } from "vue";
import { loadPlan } from "../api.js";
const result = ref(null);
const loading = ref(true);
const error = ref("");
async function refresh() {
  loading.value = true;
  error.value = "";
  result.value = null;
  try {
    result.value = await loadPlan();
  } catch {
    error.value =
      "Der Therapieplan ist gerade nicht verfügbar. Bitte prüfe die Verbindung und versuche es erneut.";
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);
</script>

<template>
  <article class="card plan" :aria-busy="loading">
    <div class="card-top">
      <h2>Dein Therapieplan</h2>
      <span v-if="result?.source === 'demo'" class="badge">Demo</span>
    </div>
    <p v-if="loading" role="status">Plan wird geladen …</p>
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button @click="refresh">Erneut versuchen</button>
    </div>
    <template v-else-if="result?.plan">
      <p class="label">Vorgegebene Belastungsgrenze · Testwert</p>
      <p class="weight">{{ result.plan.limitKg }} <span>kg</span></p>
      <p>Planversion {{ result.plan.version }} · synthetischer Beispielplan</p>
      <div class="status">Nicht auf einem Gerät angewendet</div>
      <p class="muted">
        Die medizinische Grenze wird künftig durch deinen behandelnden Arzt
        festgelegt.
      </p>
    </template>
    <template v-else
      ><h3>Noch kein Therapieplan</h3>
      <p>
        Es ist kein ärztlicher Plan hinterlegt. Ein fehlender Plan ist keine
        Freigabe für eine Belastung.
      </p></template
    >
  </article>
</template>
