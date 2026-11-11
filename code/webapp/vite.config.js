import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
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


    }),
  ],
});
