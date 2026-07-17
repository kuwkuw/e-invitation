import { readFileSync } from "node:fs";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { DesignTokens, Invitation } from "../schemas.js";

// 1200x630 is the standard OG canvas (WhatsApp/Telegram/Viber all crop to ~1.91:1).
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Token -> style maps. These mirror the palette-*/type-* classes in
// web/src/styles.css (the deterministic renderer); keep them in sync by hand.
// test/og.test.ts enforces that every enum value in schemas.ts has an entry.
export const OG_PALETTES: Record<
  DesignTokens["palette"],
  { bg: string; washTop: string; ink: string; accent: string }
> = {
  warm: { bg: "#f7efe3", washTop: "#fdf7ec", ink: "#4a3728", accent: "#b3592e" },
  elegant: { bg: "#fcfbf8", washTop: "#fffef9", ink: "#2b2b2e", accent: "#9a7b2d" },
  playful: { bg: "#fff8e1", washTop: "#fffdf2", ink: "#22336b", accent: "#e64980" },
  minimal: { bg: "#ffffff", washTop: "#ffffff", ink: "#1c1c1c", accent: "#555555" },
  festive: { bg: "#1f2a44", washTop: "#2b3a5e", ink: "#f4efe6", accent: "#e4b95b" },
  romantic: { bg: "#fbeef0", washTop: "#fdf6f7", ink: "#5a3540", accent: "#c25b74" },
};

export const OG_TYPOGRAPHY: Record<
  DesignTokens["typography"],
  { display: string; displayWeight: 400 | 700; body: string }
> = {
  serif: { display: "Playfair Display", displayWeight: 700, body: "Cormorant Garamond" },
  sans: { display: "Manrope", displayWeight: 700, body: "Manrope" },
  script: { display: "Marck Script", displayWeight: 400, body: "Cormorant Garamond" },
};

// Satori element helper (plain vdom objects — no React needed).
type Node = { type: string; props: Record<string, unknown> };
function h(type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node {
  return { type, props: { style, children: children.length === 1 ? children[0] : children } };
}

// The vendored fonts have no dingbat glyphs, so ornaments are drawn as SVG
// shapes instead of the ❧/◆/✧ characters the web preview uses.
function ornamentShape(kind: DesignTokens["ornament"], accent: string, size: number): Node | null {
  const half = size / 2;
  switch (kind) {
    case "none":
      return null;
    case "floral": {
      const petal = (cx: number, cy: number) =>
        `<circle cx="${cx}" cy="${cy}" r="${size * 0.18}" fill="${accent}" fill-opacity="0.75"/>`;
      const svg =
        `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
        petal(half, half - size * 0.24) +
        petal(half - size * 0.24, half) +
        petal(half + size * 0.24, half) +
        petal(half, half + size * 0.24) +
        `<circle cx="${half}" cy="${half}" r="${size * 0.13}" fill="${accent}"/></svg>`;
      return {
        type: "img",
        props: {
          src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          width: size,
          height: size,
          style: {},
        },
      };
    }
    case "geometric": {
      const svg =
        `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect x="${half - size * 0.28}" y="${half - size * 0.28}" width="${size * 0.56}" height="${size * 0.56}" transform="rotate(45 ${half} ${half})" fill="${accent}" fill-opacity="0.85"/></svg>`;
      return {
        type: "img",
        props: {
          src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          width: size,
          height: size,
          style: {},
        },
      };
    }
    case "sparkle": {
      const s = size;
      const svg =
        `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">` +
        `<path d="M ${half} ${s * 0.08} L ${half + s * 0.12} ${half - s * 0.12} L ${s * 0.92} ${half} L ${half + s * 0.12} ${half + s * 0.12} L ${half} ${s * 0.92} L ${half - s * 0.12} ${half + s * 0.12} L ${s * 0.08} ${half} L ${half - s * 0.12} ${half - s * 0.12} Z" fill="${accent}" fill-opacity="0.9"/></svg>`;
      return {
        type: "img",
        props: {
          src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          width: size,
          height: size,
          style: {},
        },
      };
    }
  }
}

function ornamentRow(kind: DesignTokens["ornament"], accent: string): Node | null {
  const big = ornamentShape(kind, accent, 34);
  if (!big) return null;
  const small1 = ornamentShape(kind, accent, 22)!;
  const small2 = ornamentShape(kind, accent, 22)!;
  return h(
    "div",
    { display: "flex", alignItems: "center", gap: 18, marginBottom: 34 },
    small1,
    big,
    small2,
  );
}

let fontsCache: { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[] | null =
  null;

function loadFonts() {
  if (fontsCache) return fontsCache;
  const dir = new URL("../../assets/fonts/", import.meta.url);
  const load = (file: string) => readFileSync(new URL(file, dir));
  fontsCache = [
    { name: "Playfair Display", data: load("playfair-display-700.ttf"), weight: 700, style: "normal" },
    { name: "Cormorant Garamond", data: load("cormorant-garamond-400.ttf"), weight: 400, style: "normal" },
    { name: "Cormorant Garamond", data: load("cormorant-garamond-600.ttf"), weight: 600, style: "normal" },
    { name: "Manrope", data: load("manrope-400.ttf"), weight: 400, style: "normal" },
    { name: "Manrope", data: load("manrope-700.ttf"), weight: 700, style: "normal" },
    { name: "Marck Script", data: load("marck-script-400.ttf"), weight: 400, style: "normal" },
  ];
  return fontsCache;
}

/** Render the share-link OG image (1200x630 PNG) for an invitation snapshot. */
export async function renderOgPng(invitation: Invitation): Promise<Buffer> {
  const { copy, design } = invitation;
  const palette = OG_PALETTES[design.palette];
  const typo = OG_TYPOGRAPHY[design.typography];

  const titleSize = copy.title.length > 42 ? 58 : copy.title.length > 26 ? 68 : 80;
  const details = copy.details_line.replace(/\n+/g, "  ·  ");

  const isBanner = design.layout === "banner";
  const isSplit = design.layout === "split";

  const title = isBanner
    ? h(
        "div",
        {
          display: "flex",
          justifyContent: "center",
          alignSelf: "stretch",
          backgroundColor: palette.accent,
          color: design.palette === "festive" ? "#1f2a44" : "#fffdf8",
          padding: "26px 48px",
          fontFamily: typo.display,
          fontWeight: typo.displayWeight,
          fontSize: titleSize,
          textAlign: "center",
          lineHeight: 1.1,
          marginBottom: 38,
        },
        copy.title,
      )
    : h(
        "div",
        {
          display: "flex",
          color: palette.accent,
          fontFamily: typo.display,
          fontWeight: typo.displayWeight,
          fontSize: titleSize,
          textAlign: isSplit ? "left" : "center",
          lineHeight: 1.12,
          marginBottom: 30,
          maxWidth: 1020,
        },
        copy.title,
      );

  const greeting = h(
    "div",
    {
      display: "flex",
      fontFamily: typo.body,
      fontSize: 34,
      opacity: 0.85,
      marginBottom: 18,
      textAlign: isSplit ? "left" : "center",
    },
    copy.greeting,
  );

  const detailsNode = h(
    "div",
    {
      display: "flex",
      fontFamily: typo.body,
      fontWeight: 600,
      fontSize: 38,
      textAlign: isSplit ? "left" : "center",
      ...(isSplit
        ? { borderLeft: `6px solid ${palette.accent}`, paddingLeft: 26 }
        : {}),
    },
    details,
  );

  const root = h(
    "div",
    {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: isSplit ? "flex-start" : "center",
      justifyContent: "center",
      backgroundColor: palette.bg,
      backgroundImage: `linear-gradient(180deg, ${palette.washTop} 0%, ${palette.bg} 60%)`,
      color: palette.ink,
      padding: isBanner ? "48px 0" : isSplit ? "48px 110px" : "48px 90px",
    },
    ...(isBanner ? [] : [ornamentRow(design.ornament, palette.accent)].filter(Boolean) as Node[]),
    title,
    greeting,
    detailsNode,
  );

  const svg = await satori(root as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } }).render().asPng();
  return Buffer.from(png);
}
