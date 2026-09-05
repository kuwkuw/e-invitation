// Renders the committed brand PNGs from the SVG sources next to them:
// the share cards (og-cover.png / og-cover-en.png, 1200×630) and the PWA/touch
// icons.
//
//   node scripts/build-brand-assets.mjs
//
// Run it after editing web/public/favicon.svg or the cover layout below, and
// commit the output. Generated rather than drawn so the icons cannot drift
// from the favicon, and committed rather than rendered per request because
// none of these images varies *per request*: a crawler fetching /og-cover.png
// should get a static file, not a satori render (adr-016 §3). They do vary per
// language, which is a fixed, countable set — two files, not a renderer.
//
// resvg comes from the server workspace, which already carries it for the
// per-invitation OG renderer, as do the vendored TTFs — the runtime
// Google-Fonts @import cannot feed a rasteriser any more than it can feed
// satori.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "../server/node_modules/@resvg/resvg-js/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "web/public");
const fontDir = join(root, "server/assets/fonts");

// Landing palette, from web/src/styles.css :root --lp-*.
const BG = "#f6f5f2";
const CARD = "#fffdf8";
const ACCENT = "#b3592e";
const ACCENT_WASH = "#f7efe3";
const INK = "#4a3728";
const MUTED = "#6b6659";

/** The headline, the two subhead lines and the three occasion chips, per
 *  language — mirroring `LANDING.heroTitle`/`heroText`/`chips` in
 *  `web/src/i18n.ts` by hand, the way `web/src/seo.ts` mirrors `SEO_STRINGS`.
 *  A card is a raster, so it cannot import the table it agrees with; what it
 *  can do is sit next to the one place that lists both languages side by side.
 *
 *  Ukrainian stays the unsuffixed file: `/` is the Ukrainian landing page and
 *  the primary market (01-vision), and `?lang=en` is the English page's own
 *  address (adr-016 §5) — so it gets its own card rather than unfurling in a
 *  language its reader followed a link to avoid. */
const COVER_COPY = {
  uk: {
    headline: "Запрошення за одне речення",
    lines: [
      "Опишіть подію словами — отримайте гарне запрошення,",
      "поділіться посиланням і збирайте відповіді гостей.",
    ],
    chips: ["весілля", "день народження", "корпоратив"],
  },
  en: {
    headline: "An invitation from one sentence",
    lines: [
      "Describe your event in words — get a beautiful invitation,",
      "share the link and collect your guests' replies.",
    ],
    chips: ["wedding", "birthday", "team event"],
  },
};

/** 1200×630 — the OG canvas WhatsApp, Telegram and Viber all crop to ~1.91:1,
 *  the same one og/render.ts uses for a published invitation. */
const cover = ({ headline, lines, chips }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="${CARD}" stroke="#e4ddd0" stroke-width="2"/>
  <rect x="48" y="48" width="1104" height="10" rx="5" fill="${ACCENT}"/>
  <g transform="translate(96 150)">
    <rect width="86" height="60" rx="8" fill="${ACCENT_WASH}" stroke="${ACCENT}" stroke-width="4"/>
    <path d="M3 6 43 34 83 6" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="212" y="205" font-family="Playfair Display" font-weight="700" font-size="72" fill="${INK}" letter-spacing="6">INVINTO</text>
  <text x="96" y="330" font-family="Playfair Display" font-weight="700" font-size="66" fill="${INK}">${headline}</text>
  <text x="96" y="404" font-family="Manrope" font-weight="400" font-size="34" fill="${MUTED}">${lines[0]}</text>
  <text x="96" y="452" font-family="Manrope" font-weight="400" font-size="34" fill="${MUTED}">${lines[1]}</text>
  <g transform="translate(96 496)">
    ${chips
      .map((word, i, all) => {
        // Manrope 700 at 26px averages ~15.5px per glyph in either script; the
        // chips are decoration, so an estimate that never overflows beats
        // measuring.
        const chip = (w) => w.length * 15.5 + 44;
        const x = all.slice(0, i).reduce((sum, w) => sum + chip(w) + 20, 0);
        return (
          `<rect x="${x}" y="0" width="${chip(word)}" height="56" rx="12" fill="${ACCENT_WASH}"/>` +
          `<text x="${x + 22}" y="37" font-family="Manrope" font-weight="700" font-size="26" fill="${ACCENT}">${word}</text>`
        );
      })
      .join("\n    ")}
  </g>
</svg>`;

/** The maskable icon needs its content inside the safe zone (the middle 80%),
 *  because Android crops the rest to whatever mask the launcher uses. Scaling
 *  the favicon down on a full-bleed accent field is the whole difference. */
const maskable = (
  favicon,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${ACCENT_WASH}"/>
  <g transform="translate(102.4 102.4) scale(4.8)">${favicon}</g>
</svg>`;

async function render(svg, width, outFile) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontDirs: [fontDir], loadSystemFonts: false, defaultFontFamily: "Manrope" },
  })
    .render()
    .asPng();
  await writeFile(join(publicDir, outFile), png);
  console.log(`${outFile}  ${(png.length / 1024).toFixed(1)} KB`);
}

const faviconSvg = await readFile(join(publicDir, "favicon.svg"), "utf8");
// Strip the wrapper so the favicon's shapes can be re-nested in the maskable
// canvas; the viewBox is 0 0 64 64, which the transform above assumes.
const faviconInner = faviconSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

await render(cover(COVER_COPY.uk), 1200, "og-cover.png");
await render(cover(COVER_COPY.en), 1200, "og-cover-en.png");
await render(faviconSvg, 180, "apple-touch-icon.png");
await render(faviconSvg, 192, "icon-192.png");
await render(faviconSvg, 512, "icon-512.png");
await render(maskable(faviconInner), 512, "icon-maskable-512.png");
