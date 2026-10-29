// pwa__dailySummary.js
import cron from "node-cron";
import { dbPromise } from "./db.js";
import { pwa__sendToUser } from "./pwa__push.js";

function pwa__calcScore({ limitValue, stepGoal, stepsToday, peakValues }) {
    let score = 100;

    // 100% nur wenn: unter Limit geblieben UND step goal erreicht
    // Step goal penalty: max -40
    if (stepGoal > 0) {
        const ratio = Math.min(1, stepsToday / stepGoal);
        score -= Math.round((1 - ratio) * 40);
    }

    // Limit exceed penalty: weighted by exceed height, max -60
    if (limitValue > 0) {
        const exceedRatios = peakValues
            .map((v) => Math.max(0, (v - limitValue) / limitValue))
            .filter((x) => x > 0);

        const sum = exceedRatios.reduce((a, b) => a + b, 0);
        score -= Math.min(60, Math.round(sum * 30)); // Faktor kannst du später feinjustieren
    }

    return Math.max(0, Math.min(100, score));
}

export function pwa__startDailySummaryJob() {
    cron.schedule(
        "0 19 * * *",
        async () => {
            const db = await dbPromise;
            const userId = 1;
            const day = new Date().toISOString().slice(0, 10);

            // gegen doppelte Sends
            const already = await db.get(
                `SELECT day FROM pwa__daily_summary_log WHERE day = ?`,
                [day]
            );
            if (already) return;

            // limit
            const limitRow = await db.get(
                `SELECT limit_value FROM limits WHERE user_id = ?`,
                [userId]
            );
            const limitValue = Number(limitRow?.limit_value ?? 0);

            // step goal (du hast die Tabelle "settings")
            const goalRow = await db.get(
                `SELECT step_goal FROM settings WHERE user_id = ?`,
                [userId]
            );
            const stepGoal = Number(goalRow?.step_goal ?? 0);

            // steps today
            const stepsRow = await db.get(
                `SELECT COUNT(*) as c FROM steps WHERE substr(timestamp,1,10) = ?`,
                [day]
            );
            const stepsToday = Number(stepsRow?.c ?? 0);

            // peaks today
            const peaks = await db.all(
                `SELECT peak_value FROM step_loads WHERE day = ?`,
                [day]
            );
            const peakValues = peaks.map((p) => Number(p.peak_value));

            const avgPeak =
                peakValues.length > 0
                    ? peakValues.reduce((a, b) => a + b, 0) / peakValues.length
                    : 0;

            const exceedCount =
                limitValue > 0 ? peakValues.filter((v) => v > limitValue).length : 0;

            const score = pwa__calcScore({ limitValue, stepGoal, stepsToday, peakValues });

            // Push senden
            await pwa__sendToUser(userId, {
                type: "pwa__daily_summary",
                title: `Tageszusammenfassung (${day})`,
                body: `Schritte: ${stepsToday}/${stepGoal || "—"} • ØPeak: ${avgPeak.toFixed(
                    1
                )} • Überschreitungen: ${exceedCount} • Score: ${score}%`,
                vibrate: [60, 30, 60],
            });

            // loggen
            await db.run(
                `INSERT INTO pwa__daily_summary_log (day, sent_at) VALUES (?, ?)`,
                [day, new Date().toISOString()]
            );
        },
        { timezone: "Europe/Berlin" }
    );
}
