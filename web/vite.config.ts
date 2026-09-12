import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { prerenderBlocks } from "./src/prerender";

/**
 * Ships the landing page's copy as real HTML inside `#root` (adr-016 §10).
 *
 * Without it the built document's body is one empty `<div>`: a crawler that
 * does not run JavaScript — or runs it on a queue, days later, which is what
 * Google does for a new domain — sees a title and a description over nothing.
 *
 * Build-only. The dev server is a browser with JavaScript, and dev is where a
 * stale injected copy would be most confusing.
 *
 * Both languages go in, each in its own markers; the server keeps whichever
 * the request asked for and strips the rest, so `/create` and a guest page do
 * not flash the marketing hero (`selectPrerender` in `server/src/seo.ts`).
 */
function prerenderLanding(): Plugin {
  return {
    name: "inv-prerender",
    apply: "build",
    transformIndexHtml(html) {
      const root = '<div id="root"></div>';
      if (!html.includes(root)) {
        throw new Error(`prerender: '${root}' not found in index.html`);
      }
      // Replacer function, not a string: the copy is developer-authored, but
      // `$&` in a headline would otherwise expand to the matched root div.
      return html.replace(root, () => `<div id="root">${prerenderBlocks()}</div>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), prerenderLanding()],
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
