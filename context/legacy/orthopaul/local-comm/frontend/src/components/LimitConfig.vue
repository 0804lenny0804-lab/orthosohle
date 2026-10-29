<template>
  <div>
    <!-- Belastungsgrenze -->
    <div class="card shadow-sm p-4 mb-4 mx-auto" style="max-width: 600px;">
      <h5 class="fw-bold mb-3 text-ortho">Belastungsgrenze konfigurieren</h5>

      <div class="d-flex align-items-center gap-3">
        <input
          type="number"
          class="form-control"
          placeholder="z. B. 50"
          v-model.number="localLimit"
          @keyup.enter="saveLimit"
        />
        <button class="btn btn-sohle" @click="saveLimit">
          Speichern
        </button>
      </div>

      <small class="text-muted mt-2 d-block">
        Aktuelle Grenze: 
        <strong v-if="currentLimit && !isNaN(currentLimit)">
          {{ currentLimit }} kg
        </strong>
        <strong v-else>
          Keine Belastungsgrenze eingestellt
        </strong>
      </small>
    </div>

    <!-- Schrittziel -->
    <div class="card shadow-sm p-4 mb-5 mx-auto" style="max-width: 600px;">
      <h5 class="fw-bold mb-2">Schrittziel</h5>
      <p class="text-muted small mb-3">Zielanzahl der Schritte festlegen.</p>

      <div class="d-flex align-items-center gap-3">
        <input
          type="number"
          class="form-control"
          min="1"
          placeholder="z. B. 20"
          v-model.number="localStepGoal"
          @keyup.enter="saveStepGoal"
        />
        <button class="btn btn-sohle" @click="saveStepGoal">
          Speichern
        </button>
      </div>

      <small v-if="stepGoalSaved" class="text-success mt-2 d-block">
        ✅ Schrittziel gespeichert!
      </small>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import { API_URL } from "@/api.js";

export default {
  name: "LimitConfig",

  props: {
    currentLimit: {
      type: Number,
      default: null,
    },
    stepGoal: {
      type: Number,
      default: 20,
    },
  },

  data() {
    return {
      localLimit: this.currentLimit,
      localStepGoal: this.stepGoal,
      stepGoalSaved: false,
    };
  },

  watch: {
    currentLimit(newVal) {
      this.localLimit = newVal;
    },
    stepGoal(newVal) {
      this.localStepGoal = newVal;
    },
  },

  methods: {
  // ✅ 1. Die Benachrichtigungs-Logik (Native PWA Notification)
  // ✅ 1. Die Benachrichtigungs-Logik mit sicherem 3-Sekunden-Cooldown
  async notify(title, message, isError = false) {
    // SOFORT-CHECK: Wenn gesperrt, direkt raus
    if (this.isNotificationCooldown) return;

    // SOFORT-SPERRE: Wir setzen den Cooldown, bevor wir irgendwas anderes machen
    this.isNotificationCooldown = true;

    // Sicherheits-Timer: Nach 3 Sekunden wieder freigeben
    setTimeout(() => {
      this.isNotificationCooldown = false;
    }, 3000);

    // Hardware-Vibration direkt erzwingen (zuverlässiger für Android)
    if ("vibrate" in navigator) {
      navigator.vibrate(isError ? [500, 100, 500] : [300, 100, 300]);
    }

    if (!("Notification" in window)) return;

    // Berechtigung prüfen/anfragen
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      const registration = await navigator.serviceWorker.getRegistration();
      
      const options = {
        body: message,
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        vibrate: isError ? [400, 100, 400] : [300], 
        tag: "ortho-notif", // Fester Tag verhindert Nachrichten-Stapel
        renotify: true
      };

      if (registration) {
        registration.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    }
  },

  // ✅ 2. Die Speicher-Logik für das Limit
  async saveLimit() {
    if (this.localLimit === null || this.localLimit === undefined || this.localLimit === "") {
      this.notify("Eingabe fehlt", "Bitte einen Wert eingeben!", true);
      return;
    }

    const limitNumber = Number(this.localLimit);
    if (!Number.isFinite(limitNumber) || limitNumber <= 0) {
      this.notify("Fehler", "Bitte einen gültigen Wert > 0 eingeben!", true);
      return;
    }

    // Lokal speichern
    localStorage.setItem("pwa__limit_user_1", String(limitNumber));
    this.$emit("updated", limitNumber);

    // Offline-Handling
    if (!navigator.onLine) {
      localStorage.setItem("pwa__limit_user_1_pending", "1");
      this.notify("Offline gespeichert", "Wird später synchronisiert.");
      return;
    }

    // Backend-Übertragung
    try {
      // API_URL muss in deiner Datei definiert sein (z.B. importiert oder als const)
      await axios.post(`${API_URL}/api/limits`, {
        userId: 1,
        limit_value: limitNumber,
      });

      localStorage.removeItem("pwa__limit_user_1_pending");
      this.notify("Erfolg", "Belastungsgrenze gespeichert!");
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      localStorage.setItem("pwa__limit_user_1_pending", "1");
      this.notify("Server-Fehler", "Lokal gespeichert.", true);
    }
  },

  // ✅ 3. Die Speicher-Logik für das Schrittziel
  async saveStepGoal() {
    const goalNumber = Number(this.localStepGoal);
    if (!Number.isFinite(goalNumber) || goalNumber < 1) {
      this.notify("Fehler", "Bitte ein gültiges Schrittziel eingeben!", true);
      return;
    }

    localStorage.setItem("pwa__stepGoal_user_1", String(goalNumber));
    this.$emit("step-goal-updated", goalNumber);

    if (!navigator.onLine) {
      localStorage.setItem("pwa__stepGoal_user_1_pending", "1");
      this.notify("Offline", "Schrittziel lokal gespeichert.");
      return;
    }

    try {
      await axios.post(`${API_URL}/api/step-goal`, {
        userId: 1,
        stepGoal: goalNumber,
      });
      localStorage.removeItem("pwa__stepGoal_user_1_pending");
      this.notify("Erfolg", "Schrittziel gespeichert!");
    } catch (err) {
      localStorage.setItem("pwa__stepGoal_user_1_pending", "1");
      this.notify("Server-Fehler", "Ziel lokal gesichert.", true);
    }
  }
}, // <--- Ende des methods-Objekts

  async saveLimit() {
    if (this.localLimit === null || this.localLimit === undefined || this.localLimit === "") {
      this.notify("Eingabe fehlt", "Bitte einen Wert eingeben!", true);
      return;
    }

    const limitNumber = Number(this.localLimit);
    if (!Number.isFinite(limitNumber) || limitNumber <= 0) {
      this.notify("Fehler", "Bitte einen gültigen Wert > 0 eingeben!", true);
      return;
    }

    // ✅ 1) Lokal speichern
    localStorage.setItem("pwa__limit_user_1", String(limitNumber));
    this.$emit("updated", limitNumber);

    // ✅ 2) Offline-Handling
    if (!navigator.onLine) {
      localStorage.setItem("pwa__limit_user_1_pending", "1");
      this.notify("Offline gespeichert", "Wird synchronisiert, sobald du online bist.");
      return;
    }

    // ✅ 3) Online: Backend
    try {
      await axios.post(`${API_URL}/api/limits`, {
        userId: 1,
        limit_value: limitNumber,
      });

      localStorage.removeItem("pwa__limit_user_1_pending");
      this.notify("Erfolg", "Belastungsgrenze wurde gespeichert!");
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      localStorage.setItem("pwa__limit_user_1_pending", "1");
      this.notify("Server-Fehler", "Lokal gespeichert, Synchronisierung folgt später.", true);
    }
  },

  async saveStepGoal() {
    const goalNumber = Number(this.localStepGoal);

    if (!Number.isFinite(goalNumber) || goalNumber < 1) {
      this.notify("Fehler", "Bitte ein gültiges Schrittziel eingeben!", true);
      return;
    }

    // ✅ 1) Lokal speichern
    localStorage.setItem("pwa__stepGoal_user_1", String(goalNumber));
    this.$emit("step-goal-updated", goalNumber);

    // ✅ 2) Offline-Handling
    if (!navigator.onLine) {
      localStorage.setItem("pwa__stepGoal_user_1_pending", "1");
      this.stepGoalSaved = true;
      setTimeout(() => (this.stepGoalSaved = false), 2000);
      this.notify("Offline gespeichert", "Schrittziel wird später synchronisiert.");
      return;
    }

    // ✅ 3) Online: Backend
    try {
      await axios.post(`${API_URL}/api/step-goal`, {
        userId: 1,
        stepGoal: goalNumber,
      });

      localStorage.removeItem("pwa__stepGoal_user_1_pending");
      this.stepGoalSaved = true;
      setTimeout(() => (this.stepGoalSaved = false), 2000);
      this.notify("Erfolg", "Schrittziel erfolgreich aktualisiert!");
    } catch (err) {
      console.error("Fehler beim Speichern des Schrittziels:", err);
      localStorage.setItem("pwa__stepGoal_user_1_pending", "1");
      this.notify("Server-Fehler", "Ziel lokal gespeichert.", true);
    }
  },
}
</script>
