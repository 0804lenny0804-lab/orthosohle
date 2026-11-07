const raw = import.meta.env.VITE_API_URL || "http://localhost:3000";

// entfernt trailing slash, falls jemand einen setzt
export const API_URL = raw.replace(/\/$/, "");
