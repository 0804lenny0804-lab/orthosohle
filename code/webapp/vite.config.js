import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  plugins: [
    vue(),
    VitePWA({
      strategies: "injectManifest",

      // ✅ Source-Datei, die bei dir wirklich existiert:
      srcDir: "src/pwa__",
      // ✅ Output-Datei im dist/
      filename: "pwa__sw.js",

      registerType: "autoUpdate",
      manifest: false,
      includeAssets: ["pwa__manifest.webmanifest", "pwa__icons/*"],

      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pwa__api_get_cache",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
