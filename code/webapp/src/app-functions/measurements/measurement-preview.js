import { StepDetector } from './step-detector.js';
import { createDemoSessionState } from './demo-session.js';
import { MAX_SESSION_VALUE } from './measurement-rules.js';

export const measurementPreview = {
  methods: {
    updateDemoLimit(value) {
      this.currentLimit = value;
      this.limitHistory.push({ timestamp: new Date().toISOString(), limit_value: value });
    },

    // Zentraler Datenempfang
    onRawValue({ kg, timestamp: receivedAt, source }) {
      if (!['ble', 'simulation'].includes(source)) return;
      const numericValue = Number(kg);
      const timestamp = new Date(receivedAt);
      if (!Number.isFinite(numericValue) || Number.isNaN(timestamp.getTime())) return;

      this.$refs.sessionCapture?.acceptSample({ kg: numericValue, timestamp: timestamp.toISOString(), source });
      if (numericValue < 0 || numericValue > MAX_SESSION_VALUE) return;

      if (this.previewSource && this.previewSource !== source) {
        this.rawValues = [];
        this.stepCount = 0;
        this.measurements = [];
        this.stepDetector = this.createStepDetector();
      }
      this.previewSource = source;

      // 1. Daten für Live-Graph speichern
      this.rawValues.push({ value: numericValue, timestamp: timestamp.toISOString() });
      if (this.rawValues.length > 300) this.rawValues.shift();

      // 2. WICHTIG: Daten an den Schrittzähler-Algorithmus weitergeben
      if (this.stepDetector) {
        this.stepDetector.onSample(numericValue, timestamp);
      }
    },

    resetDemoState() {
      Object.assign(this, createDemoSessionState());
      this.demoEpoch += 1;
      this.previewSource = null;
      this.stepDetector = this.createStepDetector();
    },
    createStepDetector() {
      return new StepDetector({
        minWindow: 8,
        onPeak: ({ peak, timestamp }) => {
          this.stepCount += 1;
          this.measurements.unshift({ value: peak, timestamp: new Date(timestamp).toISOString(), time: new Date(timestamp).toLocaleTimeString() });
          if (this.measurements.length > 20) this.measurements.pop();
        }
      });
    }
  },
};
