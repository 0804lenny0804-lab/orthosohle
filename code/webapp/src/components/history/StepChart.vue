<template>
  <div class="card mb-4">
    <div class="card-body">
      <h5 class="text-sohle fw-bold mb-3">Schritte pro Tag</h5>
      <div style="position: relative; height: 300px;">
        <canvas ref="chartCanvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import { Chart, registerables } from "chart.js";
import { nextTick } from "vue";
Chart.register(...registerables);

export default {
  name: "StepChart",

  props: {
    steps: { type: Array, default: () => [] }
  },

  data() {
    return { chart: null };
  },

  methods: {
    buildDailySteps() {
      const grouped = {};
      this.steps.forEach(s => {
        const day = s.timestamp.slice(0, 10);
        grouped[day] = (grouped[day] || 0) + s.step;
      });
      return { labels: Object.keys(grouped), data: Object.values(grouped) };
    },

    async renderChart() {
      if (!this.$refs.chartCanvas) return;

      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }

      await nextTick();

      const ctx = this.$refs.chartCanvas.getContext("2d");
      if (!ctx) return;

      const { labels, data } = this.buildDailySteps();

      this.chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Schritte", data, backgroundColor: "#E6007E" }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false
        }
      });
    }
  },

  mounted() {
    // Debug: zeigt, ob wirklich DIESE Datei läuft
    console.log("✅ mounted StepChart", import.meta.url);
    if (this.steps.length) this.renderChart();
  },

  watch: {
    steps: { deep: true, handler() { this.renderChart(); } }
  },

  beforeUnmount() {
    if (this.chart) this.chart.destroy();
  }
};
</script>