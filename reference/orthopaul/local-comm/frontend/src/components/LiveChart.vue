<template>
  <div class="card shadow-sm mx-auto" style="max-width: 700px;">
    <div class="card-body">
      <h5 class="card-title mb-3 text-ortho">Live Rohwerte</h5>
      <canvas ref="canvas" height="140"></canvas>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch, ref } from "vue";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale
);

const props = defineProps({
  rawValues: Array,
  currentLimit: Number
});

const canvas = ref(null);
let chart = null;

function initChart() {
  chart = new Chart(canvas.value.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Rohwerte",
          data: [],
          borderColor: "#E6007E",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          fill: false,
        },
        {
          label: "Belastungsgrenze",
          data: [],
          borderColor: "black",
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 40 // Geändert von 80 auf 40
    }
  }
}
  });
}

console.log("LiveChart rawValues:", props.rawValues);


function updateChart() {
  if (!chart) return;

  const limitedValues = props.rawValues.slice(-8);

  chart.data.labels = props.rawValues.map(v =>
    new Date(v.timestamp).toLocaleTimeString()
  );

  chart.data.datasets[0].data = props.rawValues.map(v => v.value);

  chart.data.datasets[1].data = props.rawValues.map(() =>
    props.currentLimit ?? null
  );

  chart.update("none");
}

// Rohwerte → immer aktualisieren, deep = true
watch(
  () => props.rawValues,
  () => {
    if (chart) updateChart();
  },
  { deep: true }
);

// Belastungsgrenze → auch aktualisieren
watch(
  () => props.currentLimit,
  () => {
    if (chart) updateChart();
  }
);


onMounted(() => {
  initChart();

  // Chart initialisieren, wenn er sicher exists
  setTimeout(() => {
    updateChart();
  }, 10);
});

</script>
