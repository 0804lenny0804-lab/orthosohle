<template>
  <div class="card mb-4">
    <div class="card-body d-flex gap-3 align-items-center">
      <label class="fw-bold">Zeitraum:</label>

      <select
        v-model.number="localRange"
        class="form-select w-auto"
        @change="$emit('update', localRange)"
      >
        <option :value="0">Heute</option>
        <option :value="1">Letzter Tag</option>
        <option :value="3">Letzte 3 Tage</option>
        <option :value="7">Letzte 7 Tage</option>
        <option :value="30">Letzter Monat</option>
      </select>
    </div>
  </div>
</template>

<script>
export default {
  name: "HistoryRangeSelect",

  props: {
    range: {
      type: Number,
      required: true
    }
  },

  data() {
    return {
      localRange: this.range
    };
  },

  watch: {
    range(newVal) {
      this.localRange = newVal;
    }
  }
};
</script>
