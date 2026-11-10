<template>
  <div>
    <p class="alert alert-info small" role="note">
      Diese Testwerte gelten nur in dieser Browser-Sitzung. Sie sind keinem Konto zugeordnet und werden nicht auf einem Server gespeichert.
    </p>

    <section class="card shadow-sm p-4 mb-4 mx-auto" style="max-width: 600px">
      <h2 class="h5 fw-bold mb-3 text-ortho">Belastungsgrenze konfigurieren</h2>
      <div class="d-flex align-items-center gap-3">
        <label class="visually-hidden" for="demo-limit">Belastungsgrenze in Kilogramm</label>
        <input id="demo-limit" v-model.number="localLimit" type="number" min="0.1" step="0.1"
          class="form-control" placeholder="z. B. 50" @keyup.enter="saveLimit" />
        <button class="btn btn-sohle" type="button" @click="saveLimit">Übernehmen</button>
      </div>
      <small class="text-muted mt-2 d-block">
        Aktuelle Demo-Grenze:
        <strong v-if="currentLimit && Number.isFinite(currentLimit)">{{ currentLimit }} kg</strong>
        <strong v-else>Keine Grenze eingestellt</strong>
      </small>
      <p v-if="limitError" class="text-danger small mt-2 mb-0" role="alert">{{ limitError }}</p>
    </section>

    <section class="card shadow-sm p-4 mb-5 mx-auto" style="max-width: 600px">
      <h2 class="h5 fw-bold mb-2">Schrittziel</h2>
      <p class="text-muted small mb-3">Zielanzahl der Schritte für diese Vorschau.</p>
      <div class="d-flex align-items-center gap-3">
        <label class="visually-hidden" for="demo-step-goal">Schrittziel</label>
        <input id="demo-step-goal" v-model.number="localStepGoal" type="number" min="1" step="1"
          class="form-control" placeholder="z. B. 20" @keyup.enter="saveStepGoal" />
        <button class="btn btn-sohle" type="button" @click="saveStepGoal">Übernehmen</button>
      </div>
      <small v-if="stepGoalSaved" class="text-muted mt-2 d-block" role="status">
        Für diese Sitzung übernommen; nicht dauerhaft gespeichert.
      </small>
      <p v-if="stepGoalError" class="text-danger small mt-2 mb-0" role="alert">{{ stepGoalError }}</p>
    </section>
  </div>
</template>

<script>
export default {
  name: "LimitConfig",
  props: {
    currentLimit: { type: Number, default: null },
    stepGoal: { type: Number, default: 20 },
  },
  data() {
    return {
      localLimit: this.currentLimit,
      localStepGoal: this.stepGoal,
      stepGoalSaved: false,
      limitError: "",
      stepGoalError: "",
      stepGoalTimer: null,
    };
  },
  watch: {
    currentLimit(value) { this.localLimit = value; },
    stepGoal(value) { this.localStepGoal = value; },
  },
  methods: {
    saveLimit() {
      const value = Number(this.localLimit);
      this.limitError = "";
      if (!Number.isFinite(value) || value <= 0) {
        this.limitError = "Gib einen Wert größer als null ein.";
        return;
      }
      this.$emit("updated", value);
    },
    saveStepGoal() {
      const value = Number(this.localStepGoal);
      this.stepGoalError = "";
      if (!Number.isSafeInteger(value) || value < 1) {
        this.stepGoalError = "Gib eine positive ganze Schrittzahl ein.";
        return;
      }
      this.$emit("step-goal-updated", value);
      this.stepGoalSaved = true;
      clearTimeout(this.stepGoalTimer);
      this.stepGoalTimer = setTimeout(() => { this.stepGoalSaved = false; }, 2000);
    },
  },
  beforeUnmount() { clearTimeout(this.stepGoalTimer); },
};
</script>
