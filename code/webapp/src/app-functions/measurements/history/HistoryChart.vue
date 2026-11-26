<template>
  <div class="chart-container"><canvas ref="canvas" role="img" aria-label="Gespeicherte mittlere und maximale Belastung im Zeitverlauf"></canvas></div>
</template>
<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
const props = defineProps({ samples: { type: Array, required: true } });
const canvas = ref(null);
let chart;
function render() {
  if (!canvas.value) return;
  chart?.destroy();
  const datasets = [];
  for (const [source, name, color] of [['ble', 'Bluetooth', '#b00060'], ['simulation', 'Simulation', '#315b9c']]) {
    for (const [field, label, radius] of [['avg', 'Mittel', 3], ['max', 'Maximum', 2]]) {
      datasets.push({ label: `${name} · ${label}`, data: props.samples.filter(sample => sample.source === source).map(sample => ({ x: Date.parse(sample.firstAt), y: sample[field], sample })),
        borderColor: color, backgroundColor: color, pointRadius: radius, pointStyle: field === 'max' ? 'triangle' : 'circle', showLine: false });
    }
  }
  chart = new Chart(canvas.value, { type: 'scatter', data: { datasets }, options: { responsive: true, maintainAspectRatio: false,
    animation: false, parsing: false, scales: { x: { type: 'linear', ticks: { callback: value => new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } }, y: { beginAtZero: true, title: { display: true, text: 'Belastung (kg)' } } },
    plugins: { tooltip: { callbacks: { afterLabel: context => { const sample = context.raw.sample; return `${new Date(sample.firstAt).toLocaleString('de-DE')} – ${new Date(sample.lastAt).toLocaleString('de-DE')} · ${sample.intervalCount} Sekundenintervalle · ${sample.missingSeconds} fehlende Sekunden innerhalb des Zeitraums`; } } } } } });
}
onMounted(render);
watch(() => props.samples, render);
onUnmounted(() => chart?.destroy());
</script>
<style scoped>.chart-container { position: relative; height: 340px; }</style>
