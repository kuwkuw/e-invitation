import type { DesignTokens } from "../types";

/** Design tokens per example id, shared by both languages (adr-017 §2).
 *
 *  Tokens are presentation, not words: translating them would mean two ways to
 *  say "romantic script". The four examples of an occasion must differ from
 *  each other — four `warm`/`serif`/`classic` cards tell a visitor the product
 *  has one look, and `gallery.test.ts` holds that as a rule rather than
 *  leaving it to care. */
export const GALLERY_DESIGNS: Record<string, DesignTokens> = {
  "wedding-romantic": {
    palette: "romantic",
    typography: "script",
    layout: "classic",
    ornament: "floral",
  },
  "wedding-formal": {
    palette: "elegant",
    typography: "serif",
    layout: "banner",
    ornament: "none",
  },
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
};
