const raw = import.meta.env.VITE_API_URL || "";

// entfernt trailing slash, falls jemand einen setzt
export const API_URL = raw.replace(/\/$/, "");
