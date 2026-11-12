// src/utils/stepDetector.js
export class StepDetector {
  constructor({
    threshold = 10,
    maxWindow = 40,
    smoothN = 4,
    minWindow = 8, // Verringert von 12 auf 8 für schnellere Erkennung
    onPeak
  }) {
    this.THRESH = threshold;
    this.MAX_WINDOW = maxWindow;
    this.SMOOTH_N = smoothN;
    this.MIN_WINDOW = minWindow;
    this.onPeak = onPeak;

    // interne Zustände
    this.state = "idle";        // "idle" | "collecting"
    this.rawBuf = [];
    this.currentWindow = [];
    this.rawWindow = [];

    this.cooldown = false;      // blockiert doppelte Peaks
    this.readyForStep = true;   // Schritt darf nur starten, wenn Fuß vorher frei war
  }

  async onSample(rawValue, now = new Date()) {
    const raw = Number(rawValue);

    // ---------------------------------------------------------
    // 0. COOLDOWN → Verhindert Prellen/Doppelzählen
    // ---------------------------------------------------------
    if (this.cooldown) {
      // Erhöht auf 3kg: Der Detektor wird wieder scharf, sobald der Fuß entlastet wird
      if (raw < 3) {
        this.cooldown = false;
        this.readyForStep = true;
      }
      return;
    }

    // ---------------------------------------------------------
    // 1. Glättung (Gleitender Durchschnitt)
    // ---------------------------------------------------------
    this.rawBuf.push(raw);
    if (this.rawBuf.length > this.SMOOTH_N) this.rawBuf.shift();
    const filtered = this._avg(this.rawBuf);

    // ---------------------------------------------------------
    // 2. IDLE → Warten auf den nächsten Schritt
    // ---------------------------------------------------------
    if (this.state === "idle") {
      // Fuß ist entlastet (Toleranz auf 3kg erhöht)
      if (filtered < 3) {
        this.readyForStep = true;
        return;
      }

      // Schrittstart: Kraft steigt über 5kg und Fuß war vorher oben
      if (this.readyForStep && filtered > 5) {
        this.state = "collecting";
        this.readyForStep = false;
        this.currentWindow = [filtered];
        this.rawWindow = [raw];
        return;
      }
      return;
    }

    // ---------------------------------------------------------
    // 3. COLLECTING → Belastungsphase des Schritts
    // ---------------------------------------------------------
    if (this.state === "collecting") {
      this.currentWindow.push(filtered);
      this.rawWindow.push(raw);

      // Timeout-Schutz: Falls der Schritt zu lange dauert (> MAX_WINDOW), Reset
      if (this.currentWindow.length > this.MAX_WINDOW) {
        this.state = "idle";
        return;
      }

      const enoughSamples = this.currentWindow.length >= this.MIN_WINDOW;
      const belowReset = filtered < 4; // Abrollen beendet bei unter 4kg

      if (enoughSamples && belowReset) {
        const peak = Math.max(...this.rawWindow);
        const timestamp = now.toISOString();

        // Zustände zurücksetzen
        this.cooldown = true;
        this.state = "idle";
        this.currentWindow = [];
        this.rawWindow = [];

        console.log("👣 Schritt erkannt! Peak:", peak);

        if (typeof this.onPeak === "function") {
          await this.onPeak({ peak, timestamp });
        }
        return;
      }
    }
  }

  _avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}