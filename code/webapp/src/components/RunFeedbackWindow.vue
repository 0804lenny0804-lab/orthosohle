<template>
  <section class="card">
    <div class="card-body">
      <h2 class="h5 mb-1 text-sohle">Lauf & Feedback</h2>
      <p class="text-muted small mb-3">Lokaler Demo-Lauf ohne dauerhafte oder serverseitige Speicherung.</p>

      <!-- STATUS -->
      <div class="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between mb-3">
        <div>
          <div class="fw-bold">
            Status:
            <span
              class="badge ms-2"
              :class="state === 'running'
                ? 'bg-success'
                : state === 'feedback'
                ? 'bg-warning text-dark'
                : 'bg-secondary'"
            >
              {{ stateLabel }}
            </span>
          </div>

          <div class="text-muted small" v-if="startedAt">
            Start: {{ formatDate(startedAt) }}
          </div>
          <div class="text-muted small" v-if="endedAt">
            Ende: {{ formatDate(endedAt) }}
          </div>
        </div>

        <div class="d-flex gap-2">
          <button
            v-if="state === 'idle'"
            class="btn btn-sohle"
            @click="startRun"
            :disabled="loading"
          >
            Lauf starten
          </button>

          <button
            v-if="state === 'running'"
            class="btn btn-outline-danger"
            @click="endRun"
            :disabled="loading"
          >
            Lauf beenden
          </button>

          <button
            v-if="state === 'submitted'"
            class="btn btn-outline-secondary"
            @click="resetUI"
          >
            Neuer Lauf
          </button>
        </div>
      </div>

      <!-- QUICK STATS -->
      <div v-if="state !== 'idle'" class="row g-3 mb-3">
        <div class="col-md-4">
          <div class="p-3 border rounded bg-light">
            <div class="text-muted small">Schritte aktuell</div>
            <div class="fw-bold fs-5">{{ stepCount }}</div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="p-3 border rounded bg-light">
            <div class="text-muted small">Laufdauer</div>
            <div class="fw-bold fs-5">{{ elapsedLabel }}</div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="p-3 border rounded bg-light">
            <div class="text-muted small">Schrittziel</div>
            <div class="fw-bold fs-5">{{ stepGoal }}</div>
          </div>
        </div>
      </div>

      <!-- FEEDBACK FORM -->
      <div v-if="state === 'feedback'" class="border rounded p-3">
        <h3 class="h6 fw-bold mb-2">Feedback zum Lauf</h3>
        <p class="text-muted small mb-3">Wie war der Lauf?</p>

        <div class="mb-3">
          <label class="form-label fw-bold">Bewertung</label>
          <div class="d-flex flex-wrap gap-2">
            <label class="btn btn-outline-success" :class="{ active: rating === 'gut' }">
              <input class="form-check-input me-1" type="radio" name="run-rating" value="gut" v-model="rating" />
              Gut
            </label>
            <label class="btn btn-outline-warning" :class="{ active: rating === 'mittel' }">
              <input class="form-check-input me-1" type="radio" name="run-rating" value="mittel" v-model="rating" />
              Mittel
            </label>
            <label class="btn btn-outline-danger" :class="{ active: rating === 'schlecht' }">
              <input class="form-check-input me-1" type="radio" name="run-rating" value="schlecht" v-model="rating" />
              Schlecht
            </label>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold" for="run-comment">Kommentar</label>
          <textarea
            id="run-comment"
            class="form-control"
            rows="3"
            v-model.trim="comment"
            placeholder="Optional: Was war gut/schlecht? Schmerzen? Besonderheiten?"
          />
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-sohle" @click="submitFeedback" :disabled="loading || !rating">
            Feedback nur in der Vorschau erfassen
          </button>
          <button class="btn btn-outline-secondary" @click="skipFeedback" :disabled="loading">
            Überspringen
          </button>
        </div>
      </div>

      <!-- DONE -->
      <div v-if="state === 'submitted'" class="alert alert-success mt-3 mb-0">
        Demo-Feedback wurde nur im Arbeitsspeicher erfasst. Es ist keinem Konto zugeordnet und nicht gespeichert.
      </div>

      <div v-if="error" class="alert alert-danger mt-3 mb-0">
        ❌ {{ error }}
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: "RunFeedbackWindow",

  props: {
    stepCount: { type: Number, default: 0 },
    stepGoal: { type: Number, default: 20 },
  },

  data() {
    return {
      state: "idle", // idle | running | feedback | submitted
      runId: null,
      startedAt: null,
      endedAt: null,

      rating: "",
      comment: "",

      loading: false,
      error: "",

      nowMs: Date.now(),
      timerId: null,

    };
  },

  computed: {
    stateLabel() {
      if (this.state === "idle") return "bereit";
      if (this.state === "running") return "läuft";
      if (this.state === "feedback") return "Feedback";
      return "Vorschau abgeschlossen";
    },

    elapsedMs() {
      if (!this.startedAt) return 0;

      const start = new Date(this.startedAt).getTime();
      const end =
        this.state === "running"
          ? this.nowMs
          : this.endedAt
          ? new Date(this.endedAt).getTime()
          : this.nowMs;

      return Math.max(0, end - start);
    },

    elapsedLabel() {
      const totalSec = Math.floor(this.elapsedMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      const pad = (n) => String(n).padStart(2, "0");
      return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    },
  },

  methods: {
    formatDate(iso) {
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },

    startTimer() {
      this.stopTimer();
      this.timerId = setInterval(() => {
        this.nowMs = Date.now();
      }, 250);
    },

    stopTimer() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    },

    startRun() {
      this.error = "";
      this.runId = `demo-${Date.now()}`;
      this.startedAt = new Date().toISOString();
      this.endedAt = null;
      this.rating = "";
      this.comment = "";
      this.state = "running";
      this.startTimer();
    },

    endRun() {
      if (!this.runId) return;
      this.endedAt = new Date().toISOString();
      this.state = "feedback";
      this.stopTimer();
    },

    submitFeedback() {
      if (!this.runId) return;
      if (!this.rating) return;
      this.state = "submitted";
    },

    skipFeedback() {
      this.stopTimer();
      this.state = "submitted";
    },

    resetUI() {
      this.stopTimer();
      this.state = "idle";
      this.runId = null;
      this.startedAt = null;
      this.endedAt = null;
      this.rating = "";
      this.comment = "";
      this.error = "";
    },
  },

  mounted() {
    if (this.state === "running") {
      this.startTimer();
    }
  },

  beforeUnmount() {
    this.stopTimer();
  },
};
</script>

<style scoped>
.chart-wrap {
  height: 320px;
}
</style>
