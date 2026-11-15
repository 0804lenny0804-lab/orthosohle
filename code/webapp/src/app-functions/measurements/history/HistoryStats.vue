<template>
  <div class="card mb-4">
    <div class="card-body">
      <h5 class="text-sohle fw-bold mb-3">
        Durchschnittliche Belastung
      </h5>

      <p v-if="avgPeak !== null" class="fs-4 fw-bold">
        {{ avgPeak }} kg
      </p>
      <p v-else class="text-muted small mb-0">Keine Messwerte für diesen Zeitraum.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: "HistoryStats",

  props: {
    avgPeak: {
      type: [Number, String],
      required: true
    }
  }
};
</script>
