import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
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
