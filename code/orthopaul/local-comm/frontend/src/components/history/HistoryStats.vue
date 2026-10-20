<template>
  <div class="card mb-4">
    <div class="card-body">
      <h5 class="text-sohle fw-bold mb-3">
        Durchschnittliche Belastung
      </h5>

      <p class="fs-4 fw-bold">
        {{ avgPeak }} kg
      </p>
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