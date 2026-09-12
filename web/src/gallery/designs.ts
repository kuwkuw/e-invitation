import type { DesignTokens } from "../types";

/** Design tokens per example id, shared by both languages (adr-017 §2).
 *
 *  Tokens are presentation, not words: translating them would mean two ways to
 *  say "romantic script". The four examples of an occasion must differ from
 *  each other — four `warm`/`serif`/`classic` cards tell a visitor the product
 *  has one look, and `gallery.test.ts` holds that as a rule rather than
 *  leaving it to care.
 *
 *  The spread is by occasion rather than uniform: `playful` belongs to a
 *  child's party and would be wrong on a christening, `festive`'s deep navy
 *  suits a jubilee and a New Year party. What every occasion does get is one
 *  quiet option — a host who wants no ornament at all should find it on any
 *  page they land on. */
export const GALLERY_DESIGNS: Record<string, DesignTokens> = {
  // Wedding
  "wedding-romantic": {
    palette: "romantic",
    typography: "script",
    layout: "classic",
    ornament: "floral",
  },
  "wedding-formal": { palette: "elegant", typography: "serif", layout: "banner", ornament: "none" },
  "wedding-festive": {
    palette: "festive",
    typography: "serif",
    layout: "split",
    ornament: "geometric",
  },
  "wedding-minimal": {
    palette: "minimal",
    typography: "sans",
    layout: "classic",
    ornament: "none",
  },

  // Birthday
  "birthday-warm": { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
  "birthday-formal": {
    palette: "festive",
    typography: "serif",
    layout: "banner",
    ornament: "none",
  },
  "birthday-playful": {
    palette: "playful",
    typography: "sans",
    layout: "classic",
    ornament: "sparkle",
  },
  "birthday-minimal": {
    palette: "minimal",
    typography: "sans",
    layout: "classic",
    ornament: "none",
  },

  // Kids
  "kids-playful": {
    palette: "playful",
    typography: "sans",
    layout: "banner",
    ornament: "sparkle",
  },
  "kids-warm": { palette: "warm", typography: "sans", layout: "classic", ornament: "sparkle" },
  "kids-formal": {
    palette: "festive",
    typography: "serif",
    layout: "classic",
    ornament: "geometric",
  },
  "kids-minimal": { palette: "minimal", typography: "sans", layout: "classic", ornament: "none" },

  // Christening
  "christening-quiet": {
    palette: "minimal",
    typography: "serif",
    layout: "classic",
    ornament: "none",
  },
  "christening-formal": {
    palette: "elegant",
    typography: "serif",
    layout: "classic",
    ornament: "floral",
  },
  "christening-warm": {
    palette: "warm",
    typography: "script",
    layout: "classic",
    ornament: "floral",
  },
  "christening-romantic": {
    palette: "romantic",
    typography: "serif",
    layout: "split",
    ornament: "none",
  },

  // Corporate
  "corporate-formal": {
    palette: "elegant",
    typography: "sans",
    layout: "banner",
    ornament: "none",
  },
  "corporate-festive": {
    palette: "festive",
    typography: "sans",
    layout: "classic",
    ornament: "geometric",
  },
  "corporate-minimal": {
    palette: "minimal",
    typography: "sans",
    layout: "classic",
    ornament: "none",
  },
  "corporate-warm": {
    palette: "warm",
    typography: "serif",
    layout: "split",
    ornament: "geometric",
  },

  // Jubilee
  "jubilee-festive": {
    palette: "festive",
    typography: "serif",
    layout: "classic",
    ornament: "geometric",
  },
  "jubilee-formal": { palette: "elegant", typography: "serif", layout: "banner", ornament: "none" },
  "jubilee-warm": { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
  "jubilee-minimal": {
    palette: "minimal",
    typography: "sans",
    layout: "classic",
    ornament: "none",
  },
};
