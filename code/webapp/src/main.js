import { createApp } from 'vue'
import App from './App.vue'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'

import { registerServiceWorker } from "./pwa/register.js"

const app = createApp(App)

// --- VIBRATIONS LOGIK ---
// Wir hängen eine globale Methode an die App,
// damit du sie in jeder Komponente mit this.$vibrate() aufrufen kannst.
app.config.globalProperties.$vibrate = (pattern = [200, 100, 200]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        // Falls das Handy im Energiesparmodus ist, fangen wir den Fehler ab
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.warn("Vibration vom System blockiert", e);
        }
    }
};

app.mount('#app')

registerServiceWorker()