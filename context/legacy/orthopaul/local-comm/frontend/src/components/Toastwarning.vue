<template>
  <div
    class="toast-container position-fixed bottom-0 end-0 p-3"
    style="z-index: 2000"
  >
    <div
      v-for="(t, i) in toasts"
      :key="i"
      class="toast align-items-center toast-ortho border-0 show mb-2"
      role="alert"
    >
      <div class="d-flex">
        <div class="toast-body fw-bold">
          ⚠️ {{ t.message }}
        </div>
        <button
          type="button"
          class="btn-close me-2 m-auto toast-ortho-close"
          @click="remove(i)"
        ></button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ToastWarning",

  props: {
    rawValues: {
      type: Array,
      required: true,
    },
    currentLimit: {
      type: Number,
      default: null,
    },
  },

  data() {
    return {
      toasts: [],
      isCooldown: false,             // Cooldown für den visuellen Toast
      isNotificationCooldown: false, // Cooldown für Vibration/System-Nachricht
    };
  },

  created() {
    console.log("[ToastWarning] created");
  },

  mounted() {
    console.log("[ToastWarning] mounted – Startzustand:", {
      rawValuesLength: this.rawValues.length,
      currentLimit: this.currentLimit,
    });
  },

  watch: {
    rawValues: {
      deep: true,
      handler(newArr) {
        const last = newArr[newArr.length - 1];
        console.log("[ToastWarning] rawValues geändert", {
          length: newArr.length,
          lastValue: last,
          currentLimit: this.currentLimit,
        });
        this.checkLastValue(newArr);
      },
    },

    currentLimit(newLimit) {
      console.log("[ToastWarning] currentLimit geändert:", newLimit);
    },
  },

  methods: {
  checkLastValue(values) {
    if (this.currentLimit === null || !values || values.length === 0) return;

    const latestEntry = values[values.length - 1];
    const val = latestEntry.value;

    if (val > this.currentLimit) {
      // ✅ 1. Vibration & Native Notification triggern
      this.triggerNativeNotification(val);

      // ✅ 2. Toast nur zeigen, wenn kein Cooldown für das UI-Element aktiv ist
      if (!this.isCooldown) {
        const formattedValue = Number(val).toFixed(1);
        this.addToast(`Belastungsgrenze überschritten: ${formattedValue} kg`);
      }
    }
    },
  

  async triggerNativeNotification(val) {
  if (this.isNotificationCooldown) return;
  
  this.isNotificationCooldown = true;
  const formattedValue = Number(val).toFixed(1);

  // ✅ SCHRITT 1: Direkte Hardware-Vibration (Das hat bei dir schon mal geklappt)
  // Das funktioniert, solange die App im Vordergrund ist
  if ("vibrate" in navigator) {
    navigator.vibrate([350, 110, 350]); 
  }

  // ✅ SCHRITT 2: System-Benachrichtigung
  if (Notification.permission === "granted") {
    const registration = await navigator.serviceWorker.getRegistration();
    
    const options = {
      body: `Achtung! Wert: ${formattedValue} kg`,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      vibrate: [350, 110, 350], // Vibration für den "Hintergrund"-Fall
      tag: "limit-alert",
      renotify: true
    };

    if (registration) {
      registration.showNotification("LIMIT ÜBERSCHRITTEN!", options);
    }
  }

  // ✅ SCHRITT 3: Cooldown (3 Sek)
  setTimeout(() => {
    this.isNotificationCooldown = false;
  }, 3000);
},

  addToast(message) {
    this.isCooldown = true;
    this.toasts = [{ message }];
    setTimeout(() => { this.toasts = []; }, 4000);
    setTimeout(() => { this.isCooldown = false; }, 4500);
  },

  remove(index) {
    this.toasts.splice(index, 1);
  }
}
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
}

/* OrthoSohle-Pink-Toast */
.toast-ortho {
  background-color: #E6007E;
  color: #fff;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(17, 24, 39, 0.22);
}

/* Close-Button auf dunklem Hintergrund sichtbar machen */
.toast-ortho-close {
  filter: invert(1);
}
</style>
