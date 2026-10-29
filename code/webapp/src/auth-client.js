import { createAuthClient } from "better-auth/vue";

// Gleicher Origin über den Vite-Proxy; keine Tokens im LocalStorage.
export const authClient = createAuthClient();
