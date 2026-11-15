<template>
  <AppShell :active-nav="activeNav" @navigate="setNav">
      <PhysicianApproval :identity-id="identityId" />
      <AccountView v-if="activeNav === 'account'" />

      <div v-show="activeNav === 'live'">
        <SessionCapture
          ref="sessionCapture"
          :identity-id="identityId"
          :ble-connected="bleConnected"
          :simulation-running="simulationRunning"
        />
        <div class="row g-4">
          <div class="col-lg-7">
            <section id="live" class="card">
              <div class="card-body">
                <h2 class="h5 mb-1 text-sohle">Aktuelle Belastung</h2>
                <p class="text-muted small mb-3">
                  {{ previewSource === 'simulation' ? 'Simulation' : previewSource === 'ble' ? 'Sohle verbunden' : 'Noch keine Werte empfangen' }}
                </p>
                <LiveChart :rawValues="rawValues" :currentLimit="currentLimit" />
              </div>
            </section>
          </div>

          <div class="col-lg-5 d-flex flex-column gap-4">
            <section id="steps" class="card">
              <div class="card-body">
                <h2 class="h5 mb-1 text-sohle">Schrittzähler</h2>

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

          </div>
        </section>
      </div>

      <div v-show="activeNav === 'connect'">
        <section id="connect-page" class="card">
          <div class="card-body">

        <Bluetooth :key="demoEpoch" :simulation-running="simulationRunning" @raw-value="onRawValue" @connection-state="bleConnected = $event" @connection-busy="bleBusy = $event" />
          </div>
        </section>
        <details id="simulation" class="card mt-3">
          <summary class="card-body simulation-summary">Simulation <span>{{ simulationRunning ? 'Ein' : 'Aus' }}</span></summary>
          <div class="card-body pt-0">
            <SimulationControl :key="demoEpoch" :ble-blocked="bleConnected || bleBusy" @raw-value="onRawValue" @running-state="simulationRunning = $event" />
          </div>
        </details>
      </div>

      <div v-if="activeNav === 'history'">
        <HistoryView :measurements="measurements" :limit-history="limitHistory" :identity-id="identityId" />
      </div>

      <Toastwarning :rawValues="rawValues" :currentLimit="currentLimit" />

  </AppShell>
</template>

<script>
import { watch, computed, onMounted, onUnmounted } from "vue";
import AppShell from "./shared/layout/AppShell.vue";
import AccountView from "./app-functions/account/AccountView.vue";
import PhysicianApproval from "./app-functions/doctor-access-approval/DoctorAccessApproval.vue";
import SessionCapture from "./app-functions/measurements/MeasurementSessionCapture.vue";
import Bluetooth from './app-functions/measurements/BluetoothConnection.vue';
import LiveChart from './app-functions/measurements/LiveMeasurementChart.vue';
import LimitConfig from './app-functions/measurements/MeasurementSettings.vue';
import SimulationControl from './app-functions/measurements/MeasurementSimulation.vue';
import MeasurementTable from './app-functions/measurements/RecentMeasurements.vue';
import { measurementPreview } from './app-functions/measurements/measurement-preview.js';
import Toastwarning from './app-functions/measurements/LoadLimitWarning.vue';
import StepCounter from './app-functions/measurements/StepCounter.vue';
import HistoryView from './app-functions/measurements/history/MeasurementHistory.vue';
import RunFeedbackWindow from "./app-functions/measurements/StepGoalFeedback.vue";
import { accountSession } from "./app-functions/account/account-session.js";
import { clearLegacyDemoStorage, createDemoSessionState } from "./app-functions/measurements/demo-session.js";
import { loadDisplayPreferences, applyDisplayPreferenceClasses } from "./app-functions/settings/local-preferences.js";

export default {
  name: 'App',
  mixins: [measurementPreview],
  components: {
    AppShell, AccountView, PhysicianApproval, SessionCapture, Bluetooth, LiveChart, LimitConfig, SimulationControl,
    MeasurementTable, Toastwarning, StepCounter, HistoryView, RunFeedbackWindow
  },
  data() {
    return {
      ...createDemoSessionState(),
      stepDetector: null,
      activeNav: "account",
      demoEpoch: 0,
      bleConnected: false,
      bleBusy: false,
      simulationRunning: false,
      previewSource: null,
      stopIdentityWatch: null
    };
  },
  setup() {
    const identityId = computed(() => accountSession.state.identityId || '');
    let memoryPreferencesIdentity = '';
    let memoryPreferences = null;
    const getPreferences = () => {
      if (memoryPreferencesIdentity === identityId.value && memoryPreferences) return memoryPreferences;
      try {
        return loadDisplayPreferences(window.localStorage, identityId.value);
      } catch {
        return memoryPreferencesIdentity === identityId.value && memoryPreferences
          ? memoryPreferences
          : loadDisplayPreferences(null, identityId.value);
      }
    };
    const applyDisplayPreferences = () => {
      applyDisplayPreferenceClasses(document.documentElement.classList, identityId.value, getPreferences());
    };
    const onPreferencesChanged = (event) => {
      if (event.detail?.identityId !== identityId.value || !identityId.value) return;
      memoryPreferencesIdentity = identityId.value;
      memoryPreferences = event.detail.preferences;
      applyDisplayPreferences();
    };
    let stopPreferenceWatch;
    onMounted(() => {
      applyDisplayPreferences();
      stopPreferenceWatch = watch(identityId, applyDisplayPreferences);
      window.addEventListener('display-preferences-changed', onPreferencesChanged);
    });
    onUnmounted(() => {
      stopPreferenceWatch?.();
      window.removeEventListener('display-preferences-changed', onPreferencesChanged);
      document.documentElement.classList.remove('display-contrast-high', 'display-text-large');
    });
    return {};
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


  },
  computed: {
    identityId() { return accountSession.state.identityId || ""; }
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

<style scoped>
.simulation-summary { cursor: pointer; color: #a00058; font-weight: 600; }
.simulation-summary span { float: right; color: #62656f; font-weight: 400; }
</style>
