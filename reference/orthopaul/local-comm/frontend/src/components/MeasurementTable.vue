<template>
  <div class="card shadow-sm mx-auto mb-5" style="max-width: 600px;">
    <div class="card-body">
      <h5 class="card-title mb-3 text-sohle fw-bold">Letzte Messwerte</h5>

      <div class="mb-3 p-3 bg-light rounded-3">
        <p class="mb-1 small text-muted">Aktueller Peak</p>
        <h3 class="mb-0 fw-bold" :class="getAlertClass(latestPeak)">
          {{ formatValue(latestPeak) }} <span class="h5 text-muted">kg</span>
        </h3>
      </div>

      <div class="p-2 border-top">
        <p class="mb-0 small text-muted">
          <strong>Vorheriger Peak:</strong> 
          <span v-if="previousPeak !== null" :class="getAlertClass(previousPeak)">
            {{ formatValue(previousPeak) }} kg
          </span>
          <span v-else>Noch kein Wert vorhanden</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "MeasurementTable",
  props: {
    measurements: {
      type: Array,
      required: true
    },
    // Wir übergeben das Limit, um die Werte farblich zu markieren
    currentLimit: {
      type: Number,
      default: 0
    }
  },
  computed: {
    latestPeak() {
      const first = this.measurements[0];
      if (!first) return null;
      // Prüft peak_value (Server) oder value (Live-App)
      const val = first.peak_value !== undefined ? first.peak_value : first.value;
      return val !== undefined ? Number(val) : null;
    },
    previousPeak() {
      const second = this.measurements[1];
      if (!second) return null;
      const val = second.peak_value !== undefined ? second.peak_value : second.value;
      return val !== undefined ? Number(val) : null;
    }
  },
  methods: {
    formatValue(val) {
      if (val === null || isNaN(val)) return "0.00";
      return val.toFixed(2);
    },
    getAlertClass(val) {
      // Wenn das Limit gesetzt ist (>0) und der Wert drüber liegt -> Rot
      if (this.currentLimit > 0 && val > this.currentLimit) {
        return "text-danger";
      }
      return "text-dark";
    }
  }
};
</script>

<style scoped>
.text-sohle {
  color: #E6007E;
}
.bg-light {
  background-color: #f8f9fa !important;
}
</style>