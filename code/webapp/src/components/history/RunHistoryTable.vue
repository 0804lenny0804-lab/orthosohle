<template>
  <div class="mt-4">
    <h5 class="fw-bold mb-2">Läufe & Feedback</h5>

    <div v-if="!runs || runs.length === 0" class="text-muted small">
      Keine Läufe im ausgewählten Zeitraum.
    </div>

    <div v-else class="table-responsive">
      <table class="table table-striped align-middle">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Dauer</th>
            <th class="text-end">Schritte</th>
            <th>Bewertung</th>
            <th>Kommentar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in runs" :key="r.runId">
            <td>{{ fmtDate(r.startedAt) }}</td>
            <td>{{ fmtDuration(r.startedAt, r.endedAt) }}</td>
            <td class="text-end">{{ r.stepsTotal ?? "-" }}</td>
            <td>
              <span
                v-if="r.rating"
                class="badge"
                :class="badgeClass(r.rating)"
              >
                {{ r.rating }}
              </span>
              <span v-else class="text-muted small">—</span>
            </td>
            <td style="max-width: 320px;">
              <span v-if="r.comment">{{ r.comment }}</span>
              <span v-else class="text-muted small">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: "RunHistoryTable",
  props: {
    runs: { type: Array, default: () => [] }
  },
  methods: {
 fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("de-AT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return iso;
  }
},

    fmtDuration(startIso, endIso) {
      if (!startIso || !endIso) return "-";
      const s = new Date(startIso).getTime();
      const e = new Date(endIso).getTime();
      const ms = Math.max(0, e - s);
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const sec = totalSec % 60;
      const pad = (n) => String(n).padStart(2, "0");
      return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
    },
    badgeClass(rating) {
      if (rating === "gut") return "bg-success";
      if (rating === "mittel") return "bg-warning text-dark";
      if (rating === "schlecht") return "bg-danger";
      return "bg-secondary";
    }
  }
};
</script>
