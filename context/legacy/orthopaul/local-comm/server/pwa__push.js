// pwa__push.js
import webpush from "web-push";
import { dbPromise } from "./db.js";

export function pwa__initWebPush() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subj = process.env.VAPID_SUBJECT;

    if (!pub || !priv || !subj) {
        console.warn("[pwa__] Missing VAPID env vars. Push disabled.");
        return false;
    }

    webpush.setVapidDetails(subj, pub, priv);
    return true;
}


export async function pwa__saveSubscription({ userId, subscription }) {
    const db = await dbPromise;
    const { endpoint, keys } = subscription;
    await db.run(
        `INSERT OR REPLACE INTO pwa__push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)`,
        [userId, endpoint, keys.p256dh, keys.auth, new Date().toISOString()]
    );
}

export async function pwa__deleteSubscription(endpoint) {
    const db = await dbPromise;
    await db.run(`DELETE FROM pwa__push_subscriptions WHERE endpoint = ?`, [endpoint]);
}

export async function pwa__sendToUser(userId, payloadObj) {
    console.log("[pwa__] Push send start", { userId, payloadObj });

    const db = await dbPromise;
    const subs = await db.all(
        `SELECT endpoint, p256dh, auth FROM pwa__push_subscriptions WHERE user_id = ?`,
        [userId]
    );

    console.log("[pwa__] Subscriptions found:", subs.length);

    if (!subs.length) {
        console.warn("[pwa__] No subscriptions for user", userId);
        return;
    }

    const payload = JSON.stringify(payloadObj);

    for (const s of subs) {
        console.log("[pwa__] Sending push to endpoint:", s.endpoint.slice(0, 60) + "...");

        try {
            await webpush.sendNotification(
                {
                    endpoint: s.endpoint,
                    keys: {
                        p256dh: s.p256dh,
                        auth: s.auth,
                    },
                },
                payload
            );

            // ✅ Bedeutet: Push-Service (FCM etc.) hat ihn akzeptiert
            console.log("[pwa__] Push accepted by push service");

        } catch (err) {
            console.error(
                "[pwa__] Push FAILED",
                {
                    statusCode: err?.statusCode,
                    message: err?.message,
                }
            );

            // ❌ Subscription ist tot → löschen
            if (err?.statusCode === 410 || err?.statusCode === 404) {
                console.warn("[pwa__] Subscription expired, deleting:", s.endpoint.slice(0, 60) + "...");
                await pwa__deleteSubscription(s.endpoint);
            }
        }
    }

    console.log("[pwa__] Push send finished");
}
