import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: the API runs on PORT (default 7834, npm start) and Vite on VITE_PORT (default 7835). /api is proxied, so
// the browser only ever talks to one origin (same-origin writes). This lab's one port is 7834.
const api = { target: `http://127.0.0.1:${Number(process.env.PORT) || 7834}` };

export default defineConfig({
  plugins: [react()],
  // Relative base: the built app works from any URL prefix (e.g. behind an ingress at /mock/ciba-approval-sequence/).
  base: "./",
  server: { host: "127.0.0.1", port: Number(process.env.VITE_PORT) || 7835, strictPort: true, proxy: { "/api": api } },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/testSetup.js" },
});
