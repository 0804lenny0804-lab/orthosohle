// pwa__routes_push.js
import express from "express";
import { pwa__saveSubscription, pwa__deleteSubscription, pwa__sendToUser } from "./pwa__push.js";

export const pwa__pushRouter = express.Router();

pwa__pushRouter.get("/public-key", (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

pwa__pushRouter.post("/subscribe", async (req, res) => {
    const { userId, subscription } = req.body || {};
    if (!userId || !subscription?.endpoint || !subscription?.keys) return res.status(400).json({ error: "missing data" });
    await pwa__saveSubscription({ userId, subscription });
    res.json({ ok: true });
});

pwa__pushRouter.post("/unsubscribe", async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "missing endpoint" });
    await pwa__deleteSubscription(endpoint);
    res.json({ ok: true });
});

pwa__pushRouter.post("/test", async (req, res) => {
    const userId = Number(req.body?.userId ?? 1);
    await pwa__sendToUser(userId, { title: "Ortho", body: "Test Push ✅", vibrate: [120, 60, 120] });
    res.json({ ok: true });
});

import { dbPromise } from "./db.js";

pwa__pushRouter.get("/debug/subscriptions", async (req, res) => {
    const db = await dbPromise;
    const rows = await db.all(
        `SELECT id, user_id, substr(endpoint,1,60) || '...' as endpointShort, created_at
     FROM pwa__push_subscriptions
     ORDER BY id DESC
     LIMIT 20`
    );
    res.json(rows);
});


