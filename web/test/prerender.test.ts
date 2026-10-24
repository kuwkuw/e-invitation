import { describe, expect, it } from "vitest";
import { LANDING } from "../src/i18n";
import { prerenderBlocks, prerenderMarkers } from "../src/prerender";

describe("prerender blocks", () => {
  const html = prerenderBlocks();

  it("emits one block per page per language", () => {
    // 1 landing + 1 hub + 6 occasions, twice.
    expect(html.match(/<!--pre:[a-z0-9-]+:(uk|en)-->/g)).toHaveLength(16);
  });

  it("closes every block it opens", () => {
    const opens = html.match(/<!--pre:([a-z0-9:-]+)-->/g) ?? [];
    for (const open of opens) {
      const key = open.slice("<!--pre:".length, -"-->".length);
      expect(html).toContain(`<!--/pre:${key}-->`);
    }
  });

  it("puts the occasion's real invitation text in the markup", () => {
    const { open } = prerenderMarkers("gallery-wedding:uk");
    const start = html.indexOf(open);
    expect(start).toBeGreaterThan(-1);
    expect(html.slice(start)).toContain("Ми одружуємось!");
  });

  it("puts the English invitation text in the English block", () => {
    const { open, close } = prerenderMarkers("gallery-wedding:en");
    const block = html.slice(html.indexOf(open), html.indexOf(close));
    expect(block).toContain("We're getting married!");
    // The rule `i18n.test.ts` enforces for the tables, held here for the
    // markup a crawler actually reads.
    expect(block).not.toMatch(/[Ѐ-ӿ]/);
  });

  it("links each hub tile with a crawlable href", () => {
    expect(html).toContain('href="/gallery/wedding"');
  });

  it("gives every example a crawlable use-this link", () => {
    expect(html).toContain('href="/create?sample=wedding-romantic"');
  });

  it("renders each example's design tokens as the card's classes", () => {
    // The prerendered card has to carry the same classes React will, or the
    // swap on mount is visible.
    expect(html).toContain("palette-romantic");
    expect(html).toContain("type-script");
    expect(html).toContain("layout-banner");
  });
});

// adr-017 §8. A crawler cannot press a button, so the gallery needs a real
// edge from the one page that is already indexed.
describe("landing entry point", () => {
  const html = prerenderBlocks();

  it("links to the gallery with a crawlable href", () => {
    for (const lang of ["uk", "en"] as const) {
      const { open, close } = prerenderMarkers(`landing:${lang}`);
      const block = html.slice(html.indexOf(open), html.indexOf(close));
      expect(block).toContain('href="/gallery"');
    }
  });

  it("keeps the hero's single call to action", () => {
    const { open, close } = prerenderMarkers("landing:uk");
    const block = html.slice(html.indexOf(open), html.indexOf(close));
    // The gallery link is nav chrome, not a second hero action: the hero still
    // has exactly the two /create calls to action it shipped with.
    expect(block.match(/class="lp-cta"/g)).toHaveLength(2);
  });
});

/** The landing block as a crawler, or a visitor before React mounts, reads it. */
const landingBlock = (lang: "uk" | "en") => {
  const html = prerenderBlocks();
  const { open, close } = prerenderMarkers(`landing:${lang}`);
  return html.slice(html.indexOf(open), html.indexOf(close));
};

describe("the landing hero before React mounts (adr-019 §6.1)", () => {
  it.each(["uk", "en"] as const)(
    "carries the composer's sentence in the class React types (%s)",
    (lang) => {
      const t = LANDING[lang];
      const typed = /<span class="lp-typing">([^<]*)<\/span>/.exec(landingBlock(lang))?.[1];
      expect(typed).toBe(t.heroSentence.replaceAll("&", "&amp;"));
      expect(landingBlock(lang)).toContain(t.heroPromise);
      expect(landingBlock(lang)).toContain(t.composerNote);
    },
  );

  it.each(["uk", "en"] as const)(
    "carries the stat and the guests' copy, but not their envelope (%s)",
    (lang) => {
      const t = LANDING[lang];
      const block = landingBlock(lang);
      for (const text of [
        t.statValue,
        t.statLabel,
        t.guestsTitle,
        t.guestsText,
        ...t.guestsPoints,
      ]) {
        expect(block).toContain(text);
      }
      expect(block).not.toContain("lp-guests-still");
    },
  );

  it("puts no Ukrainian in the English landing block", () => {
    expect(landingBlock("en")).not.toMatch(/[Ѐ-ӿ]/);
  });
});
