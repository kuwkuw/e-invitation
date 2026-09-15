import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The stylesheet as bytes on disk. Tests assert against the file the
 *  design-sync ships, not against a rendered DOM — jsdom does not implement
 *  `backdrop-filter`, custom-property fallbacks or `@media` evaluation, so a
 *  computed-style test here would assert the shim, not the CSS. */
export function readStyles(): string {
  return readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
}

/** Split on the file's major banner comments — `/* Title ---------- *​/`.
 *  Everything before the first banner is keyed "preamble". */
export function sections(css: string): Map<string, string> {
  const banner = /^\/\*\s*(.+?)\s*-{3,}/gm;
  const found: { title: string; start: number }[] = [];
  for (const m of css.matchAll(banner)) {
    found.push({ title: m[1], start: m.index ?? 0 });
  }
  const out = new Map<string, string>();
  out.set("preamble", css.slice(0, found[0]?.start ?? css.length));
  found.forEach((s, i) => {
    out.set(s.title, css.slice(s.start, found[i + 1]?.start ?? css.length));
  });
  return out;
}

/** Custom properties declared on a bare `:root` (not on a class or attribute).
 *  Reads only the top-level `:root`, not nested blocks inside @media queries — those
 *  are intentional conditional overrides (e.g., prefers-reduced-transparency fallbacks)
 *  and would shadow base token values if read. */
export function rootTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    const index = block.index ?? 0;
    // Count unclosed braces before this :root. Depth 0 means top level;
    // depth > 0 means nested inside an at-rule (@media, @supports, etc.).
    const beforeMatch = css.slice(0, index);
    const openBraces = (beforeMatch.match(/\{/g) ?? []).length;
    const closeBraces = (beforeMatch.match(/\}/g) ?? []).length;
    const depth = openBraces - closeBraces;

    if (depth > 0) continue;

    for (const decl of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const value = decl[2].trim();
      // A bare `var(--other-token)` alias (e.g. --accent: var(--ui-accent))
      // resolves against tokens already collected from this same block —
      // valid because CSS custom properties read in declaration order and an
      // alias is always declared after the token it points to. Anything more
      // than a single var() reference (a fallback, a calc(), ...) is left as
      // the raw declaration text; no current token needs that.
      const alias = /^var\((--[\w-]+)\)$/.exec(value);
      out.set(decl[1], alias ? (out.get(alias[1]) ?? value) : value);
    }
  }
  return out;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `fg` at `alpha` over `bg` — a translucent surface with its blur
 *  ignored, which is exactly what the spec's legibility rule assumes. */
export function blend(fg: string, alpha: number, bg: string): string {
  const [fr, fg2, fb] = rgb(fg);
  const [br, bg3, bb] = rgb(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[mix(fr, br), mix(fg2, bg3), mix(fb, bb)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
