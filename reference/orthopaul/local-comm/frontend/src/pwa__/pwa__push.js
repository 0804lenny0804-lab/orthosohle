// pwa__push.js
import axios from "axios";
import { API_URL } from "../api.js";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function pwa__enablePush({ userId = 1 }) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push wird nicht unterstützt (Browser/iOS Version prüfen).");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification Permission nicht erteilt.");

    const reg = await navigator.serviceWorker.ready;

    const { data } = await axios.get(`${API_URL}/api/pwa__push/public-key`);
    const vapidPublicKey = data?.publicKey;
    if (!vapidPublicKey) throw new Error("Backend liefert keinen VAPID Public Key.");


    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    await axios.post(`${API_URL}/api/pwa__push/subscribe`, { userId, subscription: sub });
    return sub;
}
