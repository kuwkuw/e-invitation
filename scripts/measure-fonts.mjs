// Measures what the stylesheet's Google Fonts @import costs a Ukrainian page:
// for each face (family + style) it requests, the woff2 bytes of the latin and
// cyrillic subsets, which are the two a page in either language downloads.
//
//   node scripts/measure-fonts.mjs
//
// NFR-1's bundle line counts CSS + JS from the build and so cannot see these
// bytes, which arrive from fonts.gstatic.com at first paint. This is the method
// NFR-1 cites for the font figure beside it; re-run it whenever the @import
// changes. A browser downloads a face only when text on the page uses it, so
// read the per-face rows, not just the total: a page that sets no italic never
// fetches the italic files.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = await readFile(resolve(root, "web/src/styles.css"), "utf8");

const source = /@import url\("([^"]+)"\)/.exec(css)?.[1];
if (!source) throw new Error("no @import url(...) in web/src/styles.css");

// Google Fonts serves woff2, split by unicode-range subset, only to a modern
// browser; a messenger webview on Android is the one that matters here.
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const SUBSETS = new Set(["latin", "cyrillic"]);

const fontCss = await (await fetch(source, { headers: { "user-agent": USER_AGENT } })).text();

const faces = new Map();
for (const [, subset, body] of fontCss.matchAll(
  /\/\* ([a-z-]+) \*\/\s*@font-face\s*\{([^}]*)\}/g,
)) {
  if (!SUBSETS.has(subset)) continue;
  const family = /font-family:\s*'([^']+)'/.exec(body)?.[1];
  const style = /font-style:\s*(\w+)/.exec(body)?.[1];
  const url = /url\((https:[^)]+)\)/.exec(body)?.[1];
  if (!family || !style || !url) throw new Error(`unparsed @font-face for ${subset}`);
  const bytes = (await (await fetch(url)).arrayBuffer()).byteLength;
  const face = `${family} ${style}`;
  faces.set(face, (faces.get(face) ?? 0) + bytes);
}

const kB = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
let total = 0;
for (const [face, bytes] of [...faces].sort(([a], [b]) => a.localeCompare(b))) {
  total += bytes;
  console.log(`${face.padEnd(30)} ${kB(bytes).padStart(9)}`);
}
console.log(`${"every face, latin + cyrillic".padEnd(30)} ${kB(total).padStart(9)}`);
