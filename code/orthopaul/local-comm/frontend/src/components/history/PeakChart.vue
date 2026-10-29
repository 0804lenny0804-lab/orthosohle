<template>
  <div class="peak-chart mb-5">
    <div class="chart-outer-container">
      <div class="y-axis-fixed">
        <canvas ref="yAxisCanvas"></canvas>
      </div>
      
      <div class="chart-scroll-viewport" ref="scrollContainer">
        <div class="chart-canvas-wrapper" :style="dynamicWrapperStyle">
          <canvas ref="canvas"></canvas>
        </div>
      </div>
    </div>

    <div class="chart-legend mt-3 d-flex align-items-center justify-content-center gap-4">
      <div class="legend-item d-flex align-items-center">
        <span class="optimal-box me-2"></span>
        <span class="legend-text text-muted small">Optimaler Belastungsbereich</span>
      </div>
      <div class="legend-item d-flex align-items-center">
        <span class="limit-line-icon me-2"></span>
        <span class="legend-text text-muted small">Belastungsgrenze</span>
      </div>
    </div>

    <p v-if="!hasData" class="text-muted mt-3 small text-center">
      Keine Peaks > 12 kg im gewählten Zeitraum.
    </p>
  </div>
</template>

<script>
import Chart from "chart.js/auto";

export default {
  name: "PeakChart",
  props: {
    peaks: { type: Array, default: () => [] },
    limits: { type: Array, default: () => [] }
  },
  data() {
    return {
      chart: null,
      renderQueued: false
    };
  },
  computed: {
    filteredPeaks() {
      return (this.peaks || []).filter(p => p.peak_value > 12);
    },
    hasData() { return this.filteredPeaks.length > 0; },
    dynamicWrapperStyle() {
      const count = this.filteredPeaks.length;
      // FIX: Wir nutzen 60px pro Punkt, aber deckeln die Breite bei 4000px, 
      // damit der Browser (Smiley-Fehler) nicht abstürzt.
      let widthValue = count * 60;
      if (widthValue > 4000) widthValue = 4000;
      if (widthValue < 300) widthValue = 300; // Mindestbreite

      return { 
        width: `${widthValue}px`, 
        height: "350px", 
        minWidth: "100%" 
      };
    }
  },
  methods: {
    getLimitForPeak(peak) {
      if (!this.limits.length) return 0;
      const pt = new Date(peak.timestamp);
      let foundLimit = this.limits[0].limit_value;
      for (const l of this.limits) {
        if (new Date(l.timestamp) <= pt) {
          foundLimit = l.limit_value;
        } else break;
      }
      return foundLimit;
    },
    scheduleRender() {
      if (this.renderQueued) return;
      this.renderQueued = true;
      requestAnimationFrame(() => {
        this.renderQueued = false;
        this.renderChart();
      });
    },
    destroyChart() {
      [this.$refs.canvas, this.$refs.yAxisCanvas].forEach(c => {
        if (c) {
          const ex = Chart.getChart(c);
          if (ex) ex.destroy();
        }
      });
    },
    async renderChart() {
  await this.$nextTick();
  const canvas = this.$refs.canvas;
  if (!canvas || canvas.clientWidth === 0) return;
  
  this.destroyChart();
  if (!this.hasData) return;

  const limitData = this.filteredPeaks.map(p => this.getLimitForPeak(p));
  const optimalLowData = limitData.map(l => Math.max(0, l - 3)); 
  const peakValues = this.filteredPeaks.map(p => Number(p.peak_value));
  const labels = this.filteredPeaks.map(p => {
    const d = new Date(p.timestamp);
    return d.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' });
  });

  // WICHTIG: Absolut fester Maximalwert und exakt gleiches Padding
  const fixedMax = 50; 
  const commonPadding = { top: 20, bottom: 80}; // Erhöhtes Padding für Achsen-Synchronität

  // 1. Feste Y-Achse (Die Beschriftungen links)
  new Chart(this.$refs.yAxisCanvas, {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: commonPadding },
      scales: {
        y: { 
          beginAtZero: true, 
          min: 0,
          max: fixedMax, 
          ticks: { 
            stepSize: 10, // Beschriftung alle 10kg
            font: { size: 12 } 
          },
          afterFit: (scale) => { scale.width = 50; }
        },
        x: { display: false }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });

  // 2. Hauptchart (Die Daten und Gitterlinien)
  this.chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Limit",
          data: limitData,
          borderColor: "rgba(255, 0, 0, 0.7)",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          z: 10
        },
        {
          label: "Optimal",
          data: optimalLowData,
          borderColor: "transparent",
          backgroundColor: 'rgba(0, 200, 0, 0.2)',
          fill: { target: '0' },
          pointRadius: 0,
          z: 1
        },
        {
          label: "Peaks",
          data: peakValues,
          borderColor: "#444",
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: ctx => {
            const val = ctx.raw;
            const lim = limitData[ctx.dataIndex];
            const optLow = optimalLowData[ctx.dataIndex];
            if (val > lim) return 'red';
            if (val >= optLow) return 'green';
            return '#666';
          },
          fill: { 
            target: '0', 
            above: 'rgba(255, 0, 0, 0.2)', 
            below: 'transparent' 
          },
          tension: 0.3,
          z: 20
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: commonPadding },
      plugins: { legend: { display: false } },
      scales: {
        x: { 
          ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 },
          grid: { display: false }
        },
        y: { 
          beginAtZero: true, 
          min: 0,
          max: fixedMax, 
          ticks: { display: false }, // Wir nutzen die Achse von links
          grid: { 
            color: '#e5e7eb', 
            lineWidth: 1,
            drawTicks: false // Verhindert kleine Versatze durch Tick-Striche
          }
        }
      }
    }
  });
  
  this.$nextTick(() => {
    if (this.$refs.scrollContainer) {
      this.$refs.scrollContainer.scrollLeft = this.$refs.scrollContainer.scrollWidth;
    }
  });
}
  },
  watch: {
    peaks: { deep: true, handler() { this.scheduleRender(); } },
    limits: { deep: true, handler() { this.scheduleRender(); } }
  },
  mounted() { this.scheduleRender(); }
};
</script>

<style scoped>
.chart-outer-container { display: flex; height: 350px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.y-axis-fixed { width: 50px; flex-shrink: 0; background: white; border-right: 1px solid #f1f1f1; }
.chart-scroll-viewport { flex-grow: 1; overflow-x: auto; overflow-y: hidden; }
.optimal-box { width: 20px; height: 12px; background: rgba(0, 200, 0, 0.3); border: 1px solid rgba(0, 200, 0, 0.5); display: inline-block; }
.limit-line-icon { width: 20px; border-top: 2px solid rgba(255, 0, 0, 0.7); display: inline-block; }
</style>