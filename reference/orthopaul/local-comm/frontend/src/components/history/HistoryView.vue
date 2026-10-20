<template>
<div class="history-wrapper">
<HistoryRangeSelect :range="range" @update="onRangeChange" />
<PeakChart :peaks="peaks" :limits="limits" />
<StepChart :steps="steps" />
<HistoryStats :avgPeak="avgPeak" />
<OutlierTable :outliers="outliers" />
<RunHistoryTable :runs="runs" />
</div>
</template>
<script>
import axios from "axios";
import { API_URL } from "../../api.js";
import HistoryRangeSelect from "./HistoryRangeSelect.vue";
import PeakChart from "./PeakChart.vue";
import StepChart from "./StepChart.vue";
import HistoryStats from "./HistoryStats.vue";
import OutlierTable from "./OutlierTable.vue";
import RunHistoryTable from "./RunHistoryTable.vue";
export default {
name: "HistoryView",
components: {
HistoryRangeSelect,
PeakChart,
StepChart,
HistoryStats,
OutlierTable,
RunHistoryTable
},
data() {
return {
range: 7,
peaks: [],
steps: [],
limits: [],
currentLimit: null,
avgPeak: 0,
outliers: [],
loading: false,
runs: []
};
},
methods: {
async loadData() {
this.loading = true;
let since;
if (this.range === 0) {
const d = new Date();
d.setHours(0,0,0,0);
since = d.toISOString();
} else {
since = new Date(Date.now() - this.range * 86400000).toISOString();
}
try {
const [limitRes, limitHistRes, peaksRes, stepsRes, runsRes] = await Promise.all([
axios.get(`${API_URL}/api/limits/1`),
axios.get(`${API_URL}/api/limit-history?since=${encodeURIComponent(since)}`),
axios.get(`${API_URL}/api/peaks?since=${encodeURIComponent(since)}`),
axios.get(`${API_URL}/api/steps?since=${encodeURIComponent(since)}`),
axios.get(`${API_URL}/api/runs?since=${encodeURIComponent(since)}`)
]);
this.currentLimit = limitRes.data?.limit_value ?? null;
this.limits = limitHistRes.data || [];
this.peaks = peaksRes.data || [];
this.steps = stepsRes.data || [];
this.runs = runsRes.data || [];
this.calculateStats();
} catch (err) {
console.error("Fehler beim Laden der History-Daten:", err);
} finally {
this.loading = false;
}
},
calculateStats() {
if (this.peaks.length === 0) {
this.avgPeak = 0;
this.outliers = [];
return;
}
const values = this.peaks.map((p) => p.peak_value);
const avg = values.reduce((a, b) => a + b, 0) / values.length;
this.avgPeak = avg.toFixed(1);
this.outliers = this.peaks.filter((p) => p.peak_value > avg * 1.5);
},
onRangeChange(newRange) {
this.range = newRange;
this.loadData();
}
},
mounted() {
this.loadData();
}
};
</script>
<style scoped>
.history-wrapper {
max-width: 900px;
margin: auto;
}
</style>