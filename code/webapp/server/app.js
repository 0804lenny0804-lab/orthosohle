import express from "express";
import { toNodeHandler } from "better-auth/node";
import { requireSession } from "./auth/require-session.js";

// shortcut: synthetische, schreibgeschützte Daten für lokale UI-Entwicklung;
// vor Konten-/Patientenbetrieb durch autorisierte Planpersistenz ersetzen.
export function createApp({ demo = false, auth = null } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  if (auth) {
    app.all("/api/auth/*splat", toNodeHandler(auth));
  }
  app.use(
    "/api/plan",
    auth
      ? requireSession(auth)
      : (_req, res) => {
          res.status(503).json({ error: "Anmeldung nicht konfiguriert" });
        },
  );
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
