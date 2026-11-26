<template>
  <section class="card" aria-labelledby="history-title">
    <div class="card-body">
      <h2 id="history-title" class="h5">Gespeicherter Verlauf</h2>
      <HistoryRangeSelect :range="range" @update="range = $event" />
      <p class="small text-muted">Jeder Punkt fasst gespeicherte Messwerte zusammen. Tippe auf einen Punkt für Zeitraum und mögliche Empfangslücken.</p>
      <p v-if="status === 'loading'" role="status" aria-live="polite">Verlauf wird geladen …</p>
      <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">{{ error }} <button type="button" class="btn btn-outline-secondary" @click="load">Erneut versuchen</button></div>
      <template v-else>
        <p v-if="!complete" class="alert alert-warning" role="alert">Der Verlauf ist unvollständig: Zu viele Daten für die Darstellung. Bitte einen kürzeren Zeitraum wählen.</p>
        <p v-if="samples.length === 0" class="text-muted" role="status">Keine gespeicherten Messwerte im gewählten Zeitraum.</p>
        <template v-else>
          <p role="status" class="small">{{ samples.length }} Messabschnitte · {{ samples.filter(sample => sample.source === 'ble').length }} Bluetooth · {{ samples.filter(sample => sample.source === 'simulation').length }} Simulation · {{ samples.filter(sample => sample.missingSeconds > 0).length }} mit internen Empfangslücken.</p>
          <HistoryChart :samples="samples" />
          <details class="mt-3">
            <summary>Messabschnitte als Tabelle anzeigen</summary>
            <p class="small text-muted mt-2" role="status">{{ Math.min(visibleCount, samples.length) }} von {{ samples.length }} Messabschnitten angezeigt.</p>
            <div class="table-responsive">
              <table class="table table-sm">
                <caption>Gespeicherte Messabschnitte im gewählten Zeitraum</caption>
                <thead><tr><th scope="col">Zeitraum</th><th scope="col">Quelle</th><th scope="col">Mittelwert (kg)</th><th scope="col">Maximum (kg)</th><th scope="col">Fehlende Sekunden innerhalb des Zeitraums</th></tr></thead>
                <tbody>
                  <tr v-for="sample in samples.slice(0, visibleCount)" :key="`${sample.timestamp}-${sample.sessionId}`">
                    <td>{{ formatDate(sample.firstAt) }} – {{ formatDate(sample.lastAt) }}</td>
                    <td>{{ sample.source === 'ble' ? 'Bluetooth' : 'Simulation' }}</td>
                    <td>{{ sample.avg.toFixed(2) }}</td><td>{{ sample.max.toFixed(2) }}</td><td>{{ sample.missingSeconds }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button v-if="visibleCount < samples.length" type="button" class="btn btn-outline-secondary" @click="visibleCount += 100">Weitere 100 Messabschnitte anzeigen</button>
          </details>
        </template>
      </template>
    </div>
  </section>
</template>
<script setup>
import { onUnmounted, ref, watch } from 'vue';
import HistoryRangeSelect from './HistoryRangeSelect.vue';
import HistoryChart from './HistoryChart.vue';
import { historyWindow, loadHistory } from './history-data.js';
const props = defineProps({ identityId: { type: String, default: '' } });
const range = ref(7), samples = ref([]), complete = ref(true), status = ref('loading'), error = ref('');
const visibleCount = ref(100);
const formatDate = value => new Date(value).toLocaleString('de-DE');
watch(samples, () => { visibleCount.value = 100; });
let generation = 0;
async function load() {
  const request = ++generation;
  samples.value = []; status.value = 'loading'; error.value = ''; complete.value = true;
  if (!props.identityId) { status.value = 'error'; error.value = 'Bitte melde dich an.'; return; }
  try {
    const result = await loadHistory(historyWindow(range.value), () => request === generation);
    if (request !== generation || !result) return;
    samples.value = result.samples; complete.value = result.complete; status.value = 'ready';
  } catch (cause) {
    if (request !== generation) return;
    error.value = cause.message || 'Der Verlauf konnte nicht geladen werden.'; status.value = 'error';
  }
}
watch(() => [props.identityId, range.value], load, { immediate: true });
onUnmounted(() => { generation++; });
</script>
