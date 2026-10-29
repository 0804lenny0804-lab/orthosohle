import express from "express";

// shortcut: synthetische, schreibgeschützte Daten für lokale UI-Entwicklung;
// vor Konten-/Patientenbetrieb durch autorisierte Planpersistenz ersetzen.
export function createApp({ demo = false } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/api/plan", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      source: demo ? "demo" : "unconfigured",
      plan: demo ? { version: 1, limitKg: 20 } : null,
      deviceApplied: false,
    });
  });
  return app;
}
