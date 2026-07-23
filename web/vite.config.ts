import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  test: {
    // Pure modules (calendar, csv, plural) need no DOM, but the hook and
    // component tests do; one jsdom environment for the whole suite is
    // simpler than per-file environment pragmas.
    environment: "jsdom",
    globals: false,
    restoreMocks: true,
  },
});
