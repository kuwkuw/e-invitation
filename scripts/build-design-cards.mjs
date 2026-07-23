// Builds the Claude Design "Design System" preview cards from the live
// invitation CSS in web/src/styles.css — one card per design-token value,
// plus a _gallery.html for local review (not synced).
//
// Usage: node scripts/build-design-cards.mjs [outDir]   (default: design-cards)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] ?? join(root, "design-cards"));

const css = await readFile(join(root, "web/src/styles.css"), "utf8");
const marker = "/* Invitation card";
const start = css.indexOf(marker);
if (start === -1) throw new Error(`Marker not found in styles.css: ${marker}`);
const invitationCss = css.slice(start);

const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Manrope:wght@400..800&family=Marck+Script&display=swap" rel="stylesheet">`;

const sampleCopy = `  <div class="inv-ornament" aria-hidden="true"></div>
  <h2 class="inv-title">Запрошення на день народження</h2>
  <p class="inv-greeting">Дорогі друзі!</p>
  <p class="inv-body">Запрошуємо вас відсвяткувати цей особливий день разом із нами.</p>
  <p class="inv-details">12 серпня, 18:00 — Кафе «Затишок», Львів</p>
  <p class="inv-rsvp">Будь ласка, підтвердіть свою присутність.</p>
  <p class="inv-closing">З любов'ю, Олена</p>`;

const invCard = (tokens) =>
  `<div class="inv palette-${tokens.palette} type-${tokens.typography} layout-${tokens.layout} ornament-${tokens.ornament}">\n${sampleCopy}\n</div>`;

const page = (group, title, bodyHtml) => `<!-- @dsCard group="${group}" -->
<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${fontLinks}
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: #f6f5f2; font-family: Georgia, serif; }
.frame { max-width: 520px; margin: 0 auto; }
${invitationCss}
</style>
</head>
<body>
<div class="frame">
${bodyHtml}
</div>
</body>
</html>
`;

const base = { palette: "elegant", typography: "serif", layout: "classic", ornament: "geometric" };

// One card per token value; the other tokens are picked to flatter it.
const cards = [
  ...[
    ["warm", "floral"],
    ["elegant", "geometric"],
    ["playful", "sparkle"],
    ["minimal", "none"],
    ["festive", "sparkle"],
    ["romantic", "floral"],
  ].map(([palette, ornament]) => ({
    path: `invitation/palettes/${palette}.html`,
    group: "Palettes",
    title: `Palette — ${palette}`,
    tokens: { ...base, palette, ornament },
  })),
  ...[
    ["serif", "elegant", "geometric"],
    ["sans", "minimal", "none"],
    ["script", "romantic", "floral"],
  ].map(([typography, palette, ornament]) => ({
    path: `invitation/typography/${typography}.html`,
    group: "Typography",
    title: `Typography — ${typography}`,
    tokens: { ...base, typography, palette, ornament },
  })),
  ...[
    ["classic", "warm", "floral"],
    ["banner", "elegant", "geometric"],
    ["split", "minimal", "none"],
  ].map(([layout, palette, ornament]) => ({
    path: `invitation/layouts/${layout}.html`,
    group: "Layouts",
    title: `Layout — ${layout}`,
    tokens: { ...base, layout, palette, ornament },
  })),
  ...[
    ["none", "minimal"],
    ["floral", "romantic"],
    ["geometric", "elegant"],
    ["sparkle", "festive"],
  ].map(([ornament, palette]) => ({
    path: `invitation/ornaments/${ornament}.html`,
    group: "Ornaments",
    title: `Ornament — ${ornament}`,
    tokens: { ...base, ornament, palette },
  })),
];

for (const card of cards) {
  const file = join(outDir, card.path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(card.group, card.title, invCard(card.tokens)), "utf8");
}

const gallery = page(
  "Gallery",
  "Invitation design tokens — gallery",
  cards
    .map(
      (c) =>
        `<h3 style="font-family: system-ui; color: #6b6659;">${c.title}</h3>\n${invCard(c.tokens)}`,
    )
    .join('\n<div style="height: 32px"></div>\n'),
);
await writeFile(join(outDir, "_gallery.html"), gallery, "utf8");

console.log(`Wrote ${cards.length} cards + _gallery.html to ${outDir}`);
