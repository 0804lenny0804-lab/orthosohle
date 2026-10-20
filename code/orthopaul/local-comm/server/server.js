import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { dbPromise } from "./db.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import {
  initDB,
  insertStepLoad,
  getAllStepLoads,
  getStepLoadsSince,
  getLimit,
  upsertLimit,
  getStepGoal,
  upsertStepGoal
} from "./db.js";

//pwa______________________
import { pwa__initWebPush } from "./pwa__push.js";
import { pwa__pushRouter } from "./pwa__routes_push.js";
import { pwa__startDailySummaryJob } from "./pwa__dailySummary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });





// Umgebung (lokal oder Railway)
const USE_LOCAL = process.env.USE_LOCAL === "true";

// Port abhängig von Umgebung
const PORT = USE_LOCAL ? 3000 : (Number(process.env.PORT) || 3000);


// Railway setzt automatisch RAILWAY_PUBLIC_DOMAIN
const BASE_URL = USE_LOCAL
  ? `http://localhost:${PORT}`
  : process.env.RAILWAY_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;

const app = express();
app.use(cors({
  origin: ["https://ortho-eta.vercel.app", "http://localhost:5173"], // Erlaube Vercel und lokales Dev
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// pwa__ (new)
pwa__initWebPush();
app.use("/api/pwa__push", pwa__pushRouter);
pwa__startDailySummaryJob();


const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
});

// ------------------------------------------------------
// DB INIT
// ------------------------------------------------------
await initDB().catch((err) => {
  console.error("❌ Fehler beim Initialisieren der DB:", err);
});

// ------------------------------------------------------
// Socket.IO
// ------------------------------------------------------
io.on("connection", (socket) => {
  console.log("🔌 Frontend verbunden:", socket.id);

  socket.on("disconnect", () =>
    console.log("❌ Verbindung getrennt:", socket.id)
  );
});

// ------------------------------------------------------
// ✔ EINZIGER KORREKTER PEAKS-ENDPOINT MIT ZEITFILTER
// ------------------------------------------------------
app.get("/api/peaks", async (req, res) => {
  const { since } = req.query;

  try {
    let rows;

    if (!since) {
      // Alle Einträge ohne Filter
      rows = await getAllStepLoads();
    } else {
      // Nur Einträge NACH dem Timestamp
      rows = await getStepLoadsSince(since);
    }

    res.json(rows);

  } catch (err) {
    console.error("❌ Fehler beim Laden der Peaks:", err);
    res.status(500).json({ error: "Fehler beim Laden der Peaks" });
  }
});

// ------------------------------------------------------
// Peaks speichern
// ------------------------------------------------------
app.post("/api/peaks", async (req, res) => {
  try {
    const { peak, timestamp } = req.body;

    if (peak === undefined || !timestamp) {
      return res.status(400).json({ error: "peak und timestamp erforderlich" });
    }

    const day = timestamp.slice(0, 10); // YYYY-MM-DD

    await insertStepLoad({ peak_value: Number(peak), timestamp, day });

    // =========================================
    // pwa__ limit exceeded -> server push
    // =========================================
    try {
      const userId = 1;

      const db = await dbPromise;
      const limitRow = await db.get(
        `SELECT limit_value FROM limits WHERE user_id = ?`,
        [userId]
      );
      const limitValue = Number(limitRow?.limit_value ?? 0);

      if (limitValue > 0 && Number(peak) > limitValue) {
        const exceedPct = Math.round(
          ((Number(peak) - limitValue) / limitValue) * 100
        );

        const { pwa__sendToUser } = await import("./pwa__push.js");

        await pwa__sendToUser(userId, {
          type: "pwa__limit_exceeded",
          title: "Belastungsgrenze überschritten",
          body: `Peak ${Number(peak).toFixed(1)} > Limit ${limitValue.toFixed(
            1
          )} (+${exceedPct}%)`,
          vibrate: [150, 70, 150, 70, 250],
          requireInteraction: true
        });
      }
    } catch (e) {
      console.error("[pwa__] limit push failed:", e);
    }
    // =========================================

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern des Peaks:", err);
    res.status(500).json({ error: "Speichern fehlgeschlagen" });
  }
});
// Belastungsgrenze abrufen
app.get("/api/limits/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const limit = await getLimit(userId);
    res.json({ limit_value: limit ?? 0 });
  } catch (err) {
    console.error("❌ Fehler beim Laden des Limits:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});
// ------------------------------------------------------
// Belastungsgrenze speichern + Historie sichern
// ------------------------------------------------------
app.post("/api/limits", async (req, res) => {
  try {
    const { userId, limit_value } = req.body;

    if (!userId || limit_value == null) {
      return res.status(400).json({ error: "userId und limit_value erforderlich" });
    }

    const timestamp = new Date().toISOString();

    // 1️⃣ aktuellen Wert in der Limits-Tabelle speichern/aktualisieren
    await upsertLimit(userId, limit_value);

    // 2️⃣ Wert zusätzlich in der Historie speichern
    const db = await dbPromise;
    await db.run(
      "INSERT INTO limit_history (timestamp, limit_value) VALUES (?, ?)",
      [timestamp, limit_value]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Fehler beim Speichern der Grenze:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

//pwa_________________
// pwa__ (new) set step goal (daily)
app.post("/api/pwa__settings/step-goal", async (req, res) => {
  try {
    const { userId, stepGoal } = req.body;
    if (!userId || stepGoal === undefined) {
      return res.status(400).json({ error: "userId + stepGoal erforderlich" });
    }

    const db = await dbPromise;
    await db.run(
      `INSERT OR REPLACE INTO settings (user_id, step_goal) VALUES (?, ?)`,
      [Number(userId), Number(stepGoal)]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("[pwa__] step-goal save failed:", e);
    res.status(500).json({ error: "serverfehler" });
  }
});

//Grenzwerte Historie abrufen
app.get("/api/limit-history", async (req, res) => {
  const { since } = req.query;

  try {
    const db = await dbPromise;

    const rows = await db.all(
      "SELECT * FROM limit_history WHERE timestamp >= ? ORDER BY timestamp ASC",
      [since]
    );

    res.json(rows);

  } catch (err) {
    console.error("Fehler beim Abrufen der Limit-Historie:", err);
    res.status(500).json({ error: err.message });
  }
});


// ============================================
// Schritte speichern
// ============================================
app.post("/api/steps", async (req, res) => {
  const { timestamp, step } = req.body;

  try {
    const db = await dbPromise;

    await db.run(
      "INSERT INTO steps (timestamp, step) VALUES (?, ?)",
      [timestamp, step]
    );

    //pwa__________
    // pwa__ (new) step goal reached (per day)
    try {
      const userId = 1;
      const db = await dbPromise;

      const goalRow = await db.get(`SELECT step_goal FROM settings WHERE user_id = ?`, [userId]);
      const goal = Number(goalRow?.step_goal ?? 0);

      if (goal > 0) {
        const day = String(timestamp).slice(0, 10);
        const countRow = await db.get(
          `SELECT COUNT(*) as c FROM steps WHERE substr(timestamp,1,10) = ?`,
          [day]
        );
        const stepsToday = Number(countRow?.c ?? 0);

        if (stepsToday === goal) {
          const { pwa__sendToUser } = await import("./pwa__push.js");
          await pwa__sendToUser(userId, {
            type: "pwa__step_goal",
            title: "Schritteziel erreicht 🎉",
            body: `Du hast heute ${stepsToday} Schritte geschafft.`,
            vibrate: [120, 60, 120],
          });
        }
      }
    } catch (e) {
      console.error("[pwa__] step goal push failed:", e);
    }


    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern des Schritts:", err);
    res.status(500).json({ error: err.message });
  }
});



// ============================================
// Schritte abrufen
// ============================================
app.get("/api/steps", async (req, res) => {
  const { since } = req.query;

  try {
    const db = await dbPromise;

    const rows = await db.all(
      "SELECT * FROM steps WHERE timestamp >= ? ORDER BY timestamp ASC",
      [since]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Schritte:", err);
    res.status(500).json({ error: err.message });
  }
});


// ============================================
// Lauf starten
// ============================================
app.post("/api/runs/start", async (req, res) => {
  try {
    const { startedAt, stepGoal } = req.body;
    if (!startedAt) return res.status(400).json({ error: "startedAt erforderlich" });

    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO runs (started_at, step_goal) VALUES (?, ?)",
      [startedAt, stepGoal ?? null]
    );

    // sqlite wrapper liefert meist lastID
    res.json({ runId: result.lastID });
  } catch (err) {
    console.error("❌ Fehler beim Starten des Laufs:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ============================================
// Lauf beenden
// ============================================
app.post("/api/runs/:id/end", async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const { endedAt, stepsTotal, peaksCount } = req.body;

    if (!runId || !endedAt) {
      return res.status(400).json({ error: "id und endedAt erforderlich" });
    }

    const db = await dbPromise;
    await db.run(
      "UPDATE runs SET ended_at = ?, steps_total = ?, peaks_count = ? WHERE id = ?",
      [endedAt, Number(stepsTotal ?? 0), Number(peaksCount ?? 0), runId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Beenden des Laufs:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ============================================
// Feedback speichern
// ============================================
app.post("/api/runs/:id/feedback", async (req, res) => {
  try {
    const runId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!runId || !rating) {
      return res.status(400).json({ error: "id und rating erforderlich" });
    }

    const db = await dbPromise;
    await db.run(
      "UPDATE runs SET rating = ?, comment = ? WHERE id = ?",
      [String(rating), String(comment ?? ""), runId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern des Feedbacks:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});


// ============================================
// Schrittziel abrufen
// ============================================
app.get("/api/step-goal/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const goal = await getStepGoal(userId);

    // Fallback: wenn noch nichts gesetzt, Standard 20
    res.json({ stepGoal: goal ?? 20 });
  } catch (err) {
    console.error("❌ Fehler beim Laden des Schrittziels:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ============================================
// Schrittziel speichern / updaten
// ============================================
app.post("/api/step-goal", async (req, res) => {
  try {
    const { userId, stepGoal } = req.body;

    if (!userId || stepGoal == null) {
      return res.status(400).json({ error: "userId und stepGoal erforderlich" });
    }

    await upsertStepGoal(Number(userId), Number(stepGoal));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern des Schrittziels:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});


// ============================================
// Läufe (inkl. Feedback) abrufen (für Historie)
// ============================================
app.get("/api/runs", async (req, res) => {
  const { since } = req.query;

  try {
    const db = await dbPromise;

    if (!since) {
      const rows = await db.all(
        `SELECT
           id AS runId,
           started_at AS startedAt,
           ended_at AS endedAt,
           step_goal AS stepGoal,
           steps_total AS stepsTotal,
           peaks_count AS peaksCount,
           rating,
           comment
         FROM runs
         ORDER BY started_at DESC`
      );
      return res.json(rows || []);
    }

    const rows = await db.all(
      `SELECT
         id AS runId,
         started_at AS startedAt,
         ended_at AS endedAt,
         step_goal AS stepGoal,
         steps_total AS stepsTotal,
         peaks_count AS peaksCount,
         rating,
         comment
       FROM runs
       WHERE started_at >= ?
       ORDER BY started_at DESC`,
      [since]
    );

    return res.json(rows || []);
  } catch (err) {
    console.error("❌ Fehler beim Laden der Runs:", err);
    return res.status(500).json({ error: "Fehler beim Laden der Runs" });
  }
});



// ------------------------------------------------------
// Server starten
// ------------------------------------------------------
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf ${BASE_URL}`);
});
