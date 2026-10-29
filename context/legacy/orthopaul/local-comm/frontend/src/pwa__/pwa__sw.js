/* pwa__sw.js */
import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

/* ============================================================
   PUSH EVENT & MANUELLE NOTIFICATION (SYSTEM NOTIFICATION)
   ============================================================ */
self.addEventListener("push", (event) => {
    console.log("[SW] Push received");

    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { body: event.data.text() };
        }
    }

    const title = data.title || "OrthoSohle";
    const options = {
        body: data.body || "",
        icon: "/icon-192x192.png", // Pfad prüfen (muss im public Ordner liegen)
        badge: "/icon-192x192.png",
        // Kräftiges Muster für Android/Pixel: Vibrieren(300ms) - Pause(100ms) - Vibrieren(300ms)
        vibrate: data.vibrate || [300, 100, 300],
        requireInteraction: data.requireInteraction ?? false,
        data: data.data || {},
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

/* ============================================================
   CLICK ON NOTIFICATION (App öffnen / Fokus)
   ============================================================ */
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
            // Wenn die App schon offen ist: Fokus darauf legen
            for (const client of clientsArr) {
                if ("focus" in client) return client.focus();
            }
            // Wenn die App zu ist: Neu öffnen
            if (clients.openWindow) return clients.openWindow("/");
        })
    );
});