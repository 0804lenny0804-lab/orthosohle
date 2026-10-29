// pwa__registerSW.js
import { registerSW } from "virtual:pwa-register";

export function pwa__registerServiceWorker() {
    registerSW({
        immediate: true,
        onOfflineReady() {
            console.log("[pwa__] offline ready");
        },
        onNeedRefresh() {
            console.log("[pwa__] update available");
        },
    });
}
