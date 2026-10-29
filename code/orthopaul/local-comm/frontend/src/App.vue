<template>
  <div class="app-wrapper">
    <header 
      class="border-bottom bg-white sticky-top navbar-transition" 
      :class="{ 'nav-hidden': !showNavbar }"
    >
      <div class="container d-flex flex-column flex-md-row align-items-md-center justify-content-between py-3">
        <div class="d-flex align-items-center gap-2">
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" class="me-2">
            <path d="M3 12h4l2-7 4 14 2-7h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div>
            <h1 class="h3 fw-bold mb-0">
              Ortho<span class="ortho-accent">Sohle</span>
            </h1>
            <p class="text-muted small mb-0">Reha-Monitoring • Orthopädie • Physiotherapie</p>
          </div>
        </div>

        <nav class="mt-3 mt-md-0">
          <ul class="nav nav-ortho">
            <li class="nav-item">
              <a class="nav-link" :class="{ active: activeNav === 'live' }" href="#live" @click.prevent="setNav('live')">Live</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" :class="{ active: activeNav === 'config' }" href="#config" @click.prevent="setNav('config')">Konfiguration</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" :class="{ active: activeNav === 'connect' }" href="#connect" @click.prevent="setNav('connect')">Bluetooth</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" :class="{ active: activeNav === 'history' }" href="#history" @click.prevent="setNav('history')">Historie</a>
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <main class="container py-4" id="main">

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

    </main>
  </div>
</template>

<script>
import axios from "axios";
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
    Bluetooth, LiveChart, LimitConfig, SimulationControl, 
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
      activeNav: "live",
      showNavbar: true,
      lastScrollPosition: 0
    };
  },
  methods: {
    handleScroll() {
      const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      if (Math.abs(currentScrollPosition - this.lastScrollPosition) < 10) return;
      this.showNavbar = currentScrollPosition < this.lastScrollPosition || currentScrollPosition < 50;
      this.lastScrollPosition = currentScrollPosition;
    },
    setNav(nav) {
      this.activeNav = nav;
      window.location.hash = nav;
    },
    getNavFromHash() {
      const hash = window.location.hash.replace("#", "");
      return ["live", "config", "connect", "history"].includes(hash) ? hash : "live";
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

    window.addEventListener("scroll", this.handleScroll);
    this.activeNav = this.getNavFromHash();
    window.addEventListener("hashchange", () => { this.activeNav = this.getNavFromHash(); });

    // LocalStorage & API laden
    const savedLimit = localStorage.getItem("pwa__limit_user_1");
    if (savedLimit) this.currentLimit = Number(savedLimit);
    const savedGoal = localStorage.getItem("pwa__stepGoal_user_1");
    if (savedGoal) this.stepGoal = Number(savedGoal);

    await this.loadLimit();
    await this.loadStepGoal();
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.handleScroll);
  }
}
</script>

<style>
body {
  background-color: #f5f7fa;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  overflow-x: hidden; 
}

header.sticky-top {
  transition: transform 0.3s ease-in-out;
  z-index: 1050; 
}

.nav-hidden {
  transform: translateY(-100%);
}

.app-wrapper {
  min-height: 100vh;
}

.card {
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(17, 24, 39, .08);
}

:root {
  --sohle: #E6007E;
}

.text-sohle {
  color: var(--sohle) !important;
}

.btn-sohle {
  background-color: var(--sohle) !important;
  border-color: var(--sohle) !important;
  color: white !important;
}

.ortho-accent {
  color: #E6007E;
}

.nav-ortho .nav-link {
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  color: #111827;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-ortho .nav-link.active {
  background-color: #E6007E;
  color: #fff;
}

.nav-ortho .nav-link:hover {
  color: #E6007E;
  background-color: rgba(230, 0, 126, 0.06);
}

header {
  will-change: transform;
}
</style>