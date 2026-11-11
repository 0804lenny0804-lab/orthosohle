<template>
  <div class="history-wrapper">
    <SavedSessions :identity-id="identityId" />
    <p class="alert alert-info small" role="note">
      Die folgenden Diagramme zeigen nur flüchtige Werte dieser Browseransicht. Dauerhaft gespeicherte Sekundenaggregate stehen oben.
    </p>
    <HistoryRangeSelect :range="range" @update="onRangeChange" />
    <PeakChart :peaks="peaks" :limits="limits" />
    <StepChart :steps="steps" />
    <HistoryStats :avgPeak="avgPeak" />
    <OutlierTable :outliers="outliers" />
  </div>
</template>

<script>
import HistoryRangeSelect from "./HistoryRangeSelect.vue";
import PeakChart from "./PeakChart.vue";
import StepChart from "./StepChart.vue";
import HistoryStats from "./HistoryStats.vue";
import OutlierTable from "./OutlierTable.vue";
import SavedSessions from "../../features/measurement/SavedSessions.vue";

export default {
  name: "HistoryView",
  components: { HistoryRangeSelect, PeakChart, StepChart, HistoryStats, OutlierTable, SavedSessions },
  props: {
    measurements: { type: Array, default: () => [] },
    limitHistory: { type: Array, default: () => [] },
    identityId: { type: String, default: "" },
  },
  data() { return { range: 7 }; },
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
</style>
