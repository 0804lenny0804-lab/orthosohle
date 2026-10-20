<template>
  <div class="text-center mt-5">
    <h2 class="fw-bold text-ortho mb-3">Simulation starten</h2>
    <p class="text-muted">
      Simuliert einen realistischen Kraftverlauf.
    </p>

    <div class="d-flex justify-content-center gap-3">
      <button class="btn btn-success btn-lg"
        @click="startSimulation"
        :disabled="isRunning">
        Start
      </button>

      <button class="btn btn-danger btn-lg"
        @click="stopSimulation"
        :disabled="!isRunning">
        Stopp
      </button>
    </div>
  </div>
</template>

<script>
import axios from "axios";
// pwa__ use existing API_URL constant
import { API_URL } from "../api.js";


export default {
  name: "SimulationControl",
  emits: ["raw-value"],   // 👈 ganz wichtig!

  data() {
    return {
      isRunning: false
    };
  },

  methods: 
  {
    startSimulation() {
      if (this.isRunning) return;
      this.isRunning = true;


      const runStep = () => {
        if (!this.isRunning) return;
        const waveform = this.generatePhysiologicalStep();
        let index = 0;

        const sendNext = async () => {
          if (!this.isRunning) return;

          const value = waveform[index];

          //HIER
          console.log("SIM", value);

          // 1) Rohwert an den Graphen (App.vue)
          this.$emit("raw-value", value);

          // 2) Rohwert ans Backend (Peak Detection)
          // 2) Rohwert ans Backend (Peak Detection)
          try {
            // pwa__ send raw load sample to backend
            await axios.post(`${API_URL}/api/peaks`, {
              timestamp: new Date().toISOString(),
              peak: value,
              day: new Date().toISOString().slice(0, 10),
            });
          }
          catch (err) {
            console.error("Simulation Fehler:", err);
          }

          index++;

          if (index >= waveform.length) {
            console.log("🔄 Pause 8 Sekunden");
            setTimeout(runStep, 8000);
            return;
          }

          setTimeout(sendNext, 200);
        };

        sendNext();
      };

      runStep();
    },

 generatePhysiologicalStep() {
 const peak = 18 + Math.random() * 12;  // 10 bis 30 kg
 const samples = 26 + Math.floor(Math.random() * 8);     // mehr Auflösung → besserer Realismus es werden zwischen 26 und 33 Werte erzeugt
  const waveform = [];

  // Phasenanteile
  const heelStrikeEnd = 0.15;
  const loadEnd = 0.40;
  const midstanceEnd = 0.55;
  const toeOffEnd = 0.80;

  for (let i = 0; i < samples; i++) {
    const phase = i / (samples - 1);
    let value = 0;

    // 1) Heel Strike – langsamer, kleiner Anstieg
    if (phase < heelStrikeEnd) {
      const x = phase / heelStrikeEnd;
      value = x * peak * 0.3;
    }

    // 2) Load Response – schneller Anstieg Richtung Peak
    else if (phase < loadEnd) {
      const x = (phase - heelStrikeEnd) / (loadEnd - heelStrikeEnd);
      value = peak * 0.3 + x * peak * 0.4;
    }

    // 3) Midstance – Peak wirklich erreichen
  else if (phase < midstanceEnd) {
  const x = (phase - loadEnd) / (midstanceEnd - loadEnd);

  // Verstärkte Mitte + volle Peak-Höhe
  value = peak * (0.8 + Math.sin(x * Math.PI) * 0.6);

  // Peak niemals überschreiten
  if (value > peak) value = peak;
}


    // 4) Toe-Off – abrollende Kurve
    else if (phase < toeOffEnd) {
      const x = (phase - midstanceEnd) / (toeOffEnd - midstanceEnd);
      value = peak * (0.6 - 0.6 * x);
    }

    // 5) Swing Phase – Fuß ist in der Luft
    else {
      value = 0;
    }

    // Noise wie bei echten Sensoren
    value += (Math.random() - 0.5) * 3;

    waveform.push(Math.max(0, Math.round(value)));
  }

  return waveform;
},




    stopSimulation() {
      this.isRunning = false;
    },
  },
};

</script>
