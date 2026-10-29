<template>
  <div class="card shadow-sm p-3 mb-4" style="max-width: 300px; border-radius: 15px;">
    <h5 class="fw-bold mb-3">Schrittzähler</h5>

    <p class="mb-1">
      Schritte: <strong>{{ steps || 0 }}</strong> / {{ goal || 5000 }}
    </p>

    <div class="progress" style="height: 12px; background-color: #fce4ec; border-radius: 6px;">
      <div 
        class="progress-bar progress-bar-sohle"
        role="progressbar"
        :style="{ width: progress + '%' }"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
      ></div>
    </div>
  </div>
</template>

<script>
export default {
  name: "StepCounter",
  props: {
    steps: {
      type: Number,
      default: 0
    },
    goal: {
      type: Number,
      default: 5000
    }
  },
  computed: {
    progress() {
      if (!this.goal || this.goal <= 0) return 0;
      // Begrenzung auf maximal 100%
      return Math.min(100, Math.round((this.steps / this.goal) * 100));
    }
  }
};
</script>

<style scoped>
.progress-bar-sohle {
  background-color: #E6007E !important;
  transition: width 0.5s ease;
}
</style>