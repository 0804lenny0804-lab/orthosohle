<template>
  <div class="card shadow-sm">
    <div class="card-body">
      <h5 class="text-sohle fw-bold mb-3">Ausreißer</h5>

      <div class="table-scroll-container">
        <table class="table table-hover mb-0">
          <thead class="sticky-header">
            <tr>
              <th>Peak</th>
              <th>Zeit</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="o in outliers"
              :key="o.timestamp"
            >
              <td class="fw-bold text-danger">{{ o.peak_value }} kg</td>
              <td class="small">{{ new Date(o.timestamp).toLocaleString("de-DE") }}</td>
            </tr>

            <tr v-if="outliers.length === 0">
              <td colspan="2" class="text-muted text-center py-4">
                Keine Ausreißer im Zeitraum
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "OutlierTable",
  props: {
    outliers: {
      type: Array,
      required: true
    }
  }
};
</script>

<style scoped>
/* Der Scroll-Bereich */
.table-scroll-container {
  max-height: 300px; /* Begrenzt die Höhe der Tabelle */
  overflow-y: auto;  /* Vertikaler Scrollbalken wenn nötig */
  border: 1px solid #f1f1f1;
  border-radius: 4px;
}

/* Fixiert den Tabellenkopf beim Scrollen */
.sticky-header th {
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 1;
  border-bottom: 2px solid #e5e7eb;
}

/* Scrollbar schöner machen (OrthoSohle Look) */
.table-scroll-container::-webkit-scrollbar {
  width: 6px;
}
.table-scroll-container::-webkit-scrollbar-thumb {
  background: #E6007E;
  border-radius: 10px;
}
.table-scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.text-sohle {
  color: #E6007E;
}
</style>