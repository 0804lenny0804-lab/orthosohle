<template>
  <div class="history-wrapper">
    <nav v-if="!view" class="history-menu" aria-label="Verlauf auswählen">
      <button type="button" class="card history-choice" @click="view = 'sessions'"><i class="bi bi-clock-history" aria-hidden="true"></i><span class="choice-text"><strong>Gespeicherte Messungen</strong><small>Gespeicherte Sitzungen mit Messwerten pro Sekunde, auch später abrufbar.</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="card history-choice" @click="view = 'preview'"><i class="bi bi-bar-chart" aria-hidden="true"></i><span class="choice-text"><strong>Aktuelle Vorschau</strong><small>Belastungsspitzen und Schritte dieser Browseransicht; nach Neuladen oder Kontowechsel weg.</small></span><span aria-hidden="true">›</span></button>
    </nav>
    <button v-if="view" type="button" class="btn btn-link px-0 mb-3" @click="view = ''">‹ Zurück zur Auswahl</button>
    <SavedSessions v-if="view === 'sessions'" :identity-id="identityId" />
    <div v-show="view === 'preview'">
    <p class="alert alert-info small" role="note">
      Vorschau · nicht gespeichert.
    </p>
    <HistoryRangeSelect :range="range" @update="onRangeChange" />
    <PeakChart :peaks="peaks" :limits="limits" />
    <StepChart :steps="steps" />
    <HistoryStats :avgPeak="avgPeak" />
    <OutlierTable :outliers="outliers" />
    </div>
  </div>
</template>

<script>
import HistoryRangeSelect from "./HistoryRangeSelect.vue";
import PeakChart from "./PeakChart.vue";
import StepChart from "./StepChart.vue";
import HistoryStats from "./HistoryStats.vue";
import OutlierTable from "./OutlierTable.vue";
import SavedSessions from "../SavedSessions.vue";

export default {
  name: "HistoryView",
  components: { HistoryRangeSelect, PeakChart, StepChart, HistoryStats, OutlierTable, SavedSessions },
  props: {
    measurements: { type: Array, default: () => [] },
    limitHistory: { type: Array, default: () => [] },
    identityId: { type: String, default: "" },
  },
  data() { return { range: 7, view: '' }; },
  computed: {
    rangeStart() {
      if (this.range === 0) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return start.getTime();
      }
      return Date.now() - this.range * 86400000;
    },
    peaks() {
      return this.measurements
        .filter(item => item.timestamp && Date.parse(item.timestamp) >= this.rangeStart)
        .map(item => ({ peak_value: Number(item.value), timestamp: item.timestamp }));
    },
    steps() { return this.peaks.map(item => ({ timestamp: item.timestamp, step: 1 })); },
    limits() {
      const earlier = this.limitHistory.filter(item => Date.parse(item.timestamp) < this.rangeStart).at(-1);
      const current = this.limitHistory.filter(item => Date.parse(item.timestamp) >= this.rangeStart);
      return earlier ? [earlier, ...current] : current;
    },
    avgPeak() {
      if (!this.peaks.length) return null;
      return (this.peaks.reduce((sum, item) => sum + item.peak_value, 0) / this.peaks.length).toFixed(1);
    },
    outliers() {
      const average = Number(this.avgPeak);
      return this.peaks.filter(item => item.peak_value > average * 1.5);
    },
  },
  methods: { onRangeChange(value) { this.range = value; } },
};
</script>

<style scoped>
.history-wrapper { max-width: 900px; margin: auto; }
.history-menu { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1rem; }
.history-choice { padding: 24px; display: flex; flex-direction: row; align-items: center; gap: 14px; text-align: left; color: inherit; }
.history-choice i { color: var(--sohle); font-size: 1.3rem; }
.history-choice > span:last-child { margin-left: auto; font-size: 1.4rem; }
.choice-text { display: grid; gap: 4px; }
.choice-text small { color: var(--app-muted); font-size: .8rem; }
</style>
