import { fromNodeHeaders } from "better-auth/node";

export function requireSession(auth) {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session)
        return res.status(401).json({ error: "Anmeldung erforderlich" });
      if (session.user.emailVerified !== true) {
        return res
          .status(403)
          .json({ error: "E-Mail-Bestätigung erforderlich" });
      }
      // Identität kommt ausschließlich aus der geprüften Session, nie aus Request-IDs.
      res.locals.session = session;
      next();
    } catch {
      res.status(503).json({ error: "Anmeldung derzeit nicht verfügbar" });
    }
  };
}
