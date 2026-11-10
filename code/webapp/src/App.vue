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
            <RunFeedbackWindow :key="demoEpoch" :stepCount="stepCount" :stepGoal="stepGoal" />
          </div>
        </section>

        <section id="simulation" class="card mt-4">
          <div class="card-body">
            <h2 class="h5 mb-3 text-sohle">Simulation</h2>
            <SimulationControl :key="demoEpoch" @raw-value="onRawValue" />
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
              @updated="updateDemoLimit"
              @step-goal-updated="stepGoal = $event"
            />
            <p class="small text-muted mt-3 mb-0">Push-Benachrichtigungen sind im lokalen Prototyp noch nicht mit einem Konto oder Server verbunden.</p>
          </div>
        </section>
      </div>

      <div v-show="activeNav === 'connect'">
        <section id="connect-page" class="card">
          <div class="card-body">
            <h2 class="h5 mb-1 text-sohle">Bluetooth</h2>
        <Bluetooth :key="demoEpoch" @raw-value="onRawValue" />
          </div>
        </section>
      </div>

      <div v-if="activeNav === 'history'">
        <HistoryView :measurements="measurements" :limit-history="limitHistory" />
      </div>

      <Toastwarning :rawValues="rawValues" :currentLimit="currentLimit" />

  </AppShell>
</template>

<script>
import { watch } from "vue";
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
import RunFeedbackWindow from "./components/RunFeedbackWindow.vue";
import { accountSession } from "./features/account/session.js";
import { clearLegacyDemoStorage, createDemoSessionState } from "./features/demo/demo-state.js";

export default {
  name: 'App',
  components: {
    AppShell, AccountView, Bluetooth, LiveChart, LimitConfig, SimulationControl,
    MeasurementTable, Toastwarning, StepCounter, HistoryView, RunFeedbackWindow
  },
  data() {
    return {
      ...createDemoSessionState(),
      stepDetector: null,
      activeNav: "account",
      demoEpoch: 0,
      stopIdentityWatch: null
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

    updateDemoLimit(value) {
      this.currentLimit = value;
      this.limitHistory.push({ timestamp: new Date().toISOString(), limit_value: value });
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

    resetDemoState() {
      Object.assign(this, createDemoSessionState());
      this.demoEpoch += 1;
      this.stepDetector = new StepDetector({
        threshold: 15,
        minWindow: 8,
        onPeak: ({ peak, timestamp }) => {
          this.stepCount += 1;
          this.measurements.unshift({ value: peak, timestamp: new Date(timestamp).toISOString(), time: new Date(timestamp).toLocaleTimeString() });
          if (this.measurements.length > 20) this.measurements.pop();
        }
      });
    }
  },

  async mounted() {
    clearLegacyDemoStorage(window.localStorage);
    this.resetDemoState();
    this.stopIdentityWatch = watch(() => accountSession.state.identityId, () => this.resetDemoState());

    this.activeNav = this.getNavFromHash();
    window.addEventListener("hashchange", this.handleHashChange);
    window.addEventListener("popstate", this.handleHashChange);

  },
  beforeUnmount() {
    this.stopIdentityWatch?.();
    window.removeEventListener("hashchange", this.handleHashChange);
    window.removeEventListener("popstate", this.handleHashChange);
  }
}
</script>
