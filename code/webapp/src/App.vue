<template>
  <AppShell :active-nav="activeNav" @navigate="setNav">
      <AccountView v-if="activeNav === 'account'" />

      <div v-show="activeNav === 'live'">
        <div class="row g-4">
          <div class="col-lg-7">
            <section id="live" class="card">
              <div class="card-body">
                <h2 class="h5 mb-1 text-sohle">Gewichtsanzeige & Status</h2>
                <p class="text-muted small mb-3">Live-Werte & Verlauf</p>
                <LiveChart :rawValues="rawValues" :currentLimit="currentLimit" />
              </div>
            </section>
          </div>

          <div class="col-lg-5 d-flex flex-column gap-4">
            <section id="steps" class="card">
              <div class="card-body">
                <h2 class="h5 mb-1 text-sohle">Schrittzähler</h2>
                <p class="text-muted small mb-3">Jeder erkannte Peak entspricht einem Schritt.</p>
                <StepCounter :steps="stepCount" :goal="stepGoal" />
              </div>
            </section>

            <section id="history-preview" class="card">
              <div class="card-body">
                <h2 class="h5 mb-1 text-sohle">Letzte Messwerte</h2>
                <p class="text-muted small mb-3">Die neuesten erkannten Peaks</p>
                <MeasurementTable :measurements="measurements" />
              </div>
            </section>
          </div>
        </div>

        <section class="card mt-4">
          <div class="card-body">
            <RunFeedbackWindow :stepCount="stepCount" :stepGoal="stepGoal" :peaksCount="measurements.length" />
          </div>
        </section>

        <section id="simulation" class="card mt-4">
          <div class="card-body">
            <h2 class="h5 mb-3 text-sohle">Simulation</h2>
            <SimulationControl @raw-value="onRawValue" />
          </div>
        </section>
      </div>

      <div v-if="activeNav === 'config'">
        <section id="config" class="card">
          <div class="card-body">
            <h2 class="h5 mb-1 text-sohle">Konfiguration</h2>
            <LimitConfig
              :currentLimit="currentLimit"
              :stepGoal="stepGoal"
              @updated="currentLimit = $event"
              @step-goal-updated="stepGoal = $event"
            />
            <button class="btn btn-outline-secondary mt-3" @click="pwa__onEnablePush">Push aktivieren</button>
          </div>
        </section>
      </div>

      <div v-show="activeNav === 'connect'">
        <section id="connect-page" class="card">
          <div class="card-body">
            <h2 class="h5 mb-1 text-sohle">Bluetooth</h2>
            <Bluetooth @raw-value="onRawValue" />
          </div>
        </section>
      </div>

      <div v-if="activeNav === 'history'">
        <HistoryView :measurements="measurements" />
      </div>

      <Toastwarning :rawValues="rawValues" :currentLimit="currentLimit" />

  </AppShell>
</template>

<script>
import axios from "axios";
import AppShell from "./components/shell/AppShell.vue";
import AccountView from "./features/account/AccountView.vue";
import Bluetooth from './components/Bluetooth.vue';
import LiveChart from './components/LiveChart.vue';
import LimitConfig from './components/LimitConfig.vue';
import SimulationControl from './components/SimulationControl.vue';
import MeasurementTable from './components/MeasurementTable.vue';
import { StepDetector } from './components/stepdetector.js'; // Pfad prüfen!
import Toastwarning from './components/Toastwarning.vue';
import StepCounter from './components/stepcounter.vue';
import HistoryView from './components/history/HistoryView.vue';
import { API_URL } from "./api.js";
import RunFeedbackWindow from "./components/RunFeedbackWindow.vue";
import { pwa__enablePush } from "./pwa__/pwa__push.js";

export default {
  name: 'App',
  components: {
    AppShell, AccountView, Bluetooth, LiveChart, LimitConfig, SimulationControl,
    MeasurementTable, Toastwarning, StepCounter, HistoryView, RunFeedbackWindow
  },
  data() {
    return {
      measurements: [],
      rawValues: [],
      currentLimit: null,
      stepDetector: null,
      stepCount: 0,
      stepGoal: 20,
      activeNav: "account"
    };
  },
  methods: {
    setNav(nav) {
      this.activeNav = nav;
      if (window.location.hash !== `#${nav}`) window.history.pushState(null, "", `#${nav}`);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    getNavFromHash() {
      const hash = window.location.hash.replace("#", "").split("?")[0];
      return ["account", "live", "config", "connect", "history"].includes(hash) ? hash : "account";
    },

    handleHashChange() {
      this.activeNav = this.getNavFromHash();
    },

    // Zentraler Datenempfang
    onRawValue(value) {
      const numericValue = Number(value);
      const timestamp = new Date();

      // 1. Daten für Live-Graph speichern
      this.rawValues.push({ value: numericValue, timestamp: timestamp.toISOString() });
      if (this.rawValues.length > 300) this.rawValues.shift();

      // 2. WICHTIG: Daten an den Schrittzähler-Algorithmus weitergeben
      if (this.stepDetector) {
        this.stepDetector.onSample(numericValue, timestamp);
      }
    },

    async pwa__onEnablePush() {
      try {
        await pwa__enablePush({ userId: 1 });
        alert("Push aktiviert ✅");
      } catch (e) {
        alert("Fehler: " + e.message);
      }
    },
    async loadStepGoal() {
      try {
        const res = await axios.get(`${API_URL}/api/step-goal/1`);
        if (res.data) this.stepGoal = res.data.stepGoal;
      } catch (e) { console.warn("Kein Ziel geladen"); }
    },
    async loadLimit() {
      try {
        const res = await axios.get(`${API_URL}/api/limits/1`);
        if (res.data) this.currentLimit = res.data.limit_value;
      } catch (e) { console.warn("Kein Limit geladen"); }
    }
  },

  async mounted() {
    // INITIALISIERUNG DES SCHRITTZÄHLERS
    this.stepDetector = new StepDetector({
      threshold: 15,
      minWindow: 8,
      onPeak: ({ peak, timestamp }) => {
        // Diese Funktion wird aufgerufen, wenn stepdetector.js einen Schritt erkennt
        this.stepCount++;

        // Messwert in Tabelle eintragen
        this.measurements.unshift({
          value: peak,
          time: new Date(timestamp).toLocaleTimeString()
        });
        if (this.measurements.length > 20) this.measurements.pop();

        console.log("Schritt erkannt! Peak:", peak, "Total:", this.stepCount);
      }
    });

    this.activeNav = this.getNavFromHash();
    window.addEventListener("hashchange", this.handleHashChange);
    window.addEventListener("popstate", this.handleHashChange);

    // LocalStorage & API laden
    const savedLimit = localStorage.getItem("pwa__limit_user_1");
    if (savedLimit) this.currentLimit = Number(savedLimit);
    const savedGoal = localStorage.getItem("pwa__stepGoal_user_1");
    if (savedGoal) this.stepGoal = Number(savedGoal);

    await this.loadLimit();
    await this.loadStepGoal();
  },
  beforeUnmount() {
    window.removeEventListener("hashchange", this.handleHashChange);
    window.removeEventListener("popstate", this.handleHashChange);
  }
}
</script>
