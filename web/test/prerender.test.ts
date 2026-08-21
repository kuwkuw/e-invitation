import { describe, expect, it } from "vitest";
import { LANDING } from "../src/i18n";
import { landingBodyHtml, landingPrerenderBlocks, prerenderMarkers } from "../src/prerender";

/**
 * The landing page's copy as real HTML in the shell (adr-016 §10).
 *
 * The failure this guards against is silent: the SPA's body is one empty div,
 * and a crawler that does not run JavaScript — or runs it days later, which is
 * what Google does for a new domain — reads a title and a description over
 * nothing. These tests assert against `LANDING` rather than against literal
 * strings on purpose: the value of generating this block is that the copy has
 * one source, and a test carrying its own copy would quietly re-create the
 * second one.
 */
describe("landingBodyHtml", () => {
  it.each(["uk", "en"] as const)("carries every line of %s copy a result could quote", (lang) => {
    const html = landingBodyHtml(lang);
    const t = LANDING[lang];
    for (const line of [
      t.heroTitle,
      t.heroText,
      t.howTitle,
      t.rsvpTitle,
      t.rsvpText,
      t.finalTitle,
      t.footer,
    ]) {
      expect(html).toContain(line);
    }
    for (const step of t.steps) {
      expect(html).toContain(step.title);
      expect(html).toContain(step.text);
    }
    // The occasion words are the search terms the page exists to be found for.
    for (const chip of t.chips) expect(html).toContain(chip);
  });

  it("has exactly one h1, and it is the hero", () => {
    const html = landingBodyHtml("uk");
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${LANDING.uk.heroTitle}</h1>`);
  });

  // A crawler cannot press a button, and the real page's CTA is one — so
  // without this the editor is reachable only by rendering the app.
  it("gives the crawl a real link to the editor", () => {
    expect(landingBodyHtml("uk")).toContain('<a class="lp-cta" href="/create">');
  });

  it("differs by language", () => {
    expect(landingBodyHtml("uk")).not.toBe(landingBodyHtml("en"));
    expect(landingBodyHtml("en")).toContain(LANDING.en.heroTitle);
    expect(landingBodyHtml("en")).not.toContain(LANDING.uk.heroTitle);
  });

  // Landing copy is full of «», — and apostrophes; one `&` in a future edit
  // must not be able to produce broken markup.
  it("escapes its copy", () => {
    const html = landingBodyHtml("uk");
    expect(html).not.toMatch(/&(?!amp;|quot;|lt;|gt;)/);
  });

  it("uses the classes the React page uses, so the swap is invisible", () => {
    const html = landingBodyHtml("uk");
    for (const cls of ["landing", "lp-hero", "lp-hero-copy", "lp-steps", "lp-chips", "lp-footer"]) {
      expect(html).toContain(`class="${cls}"`);
    }
  });
});

describe("landingPrerenderBlocks", () => {
  it("wraps both languages in the markers the server strips by", () => {
    const blocks = landingPrerenderBlocks();
    for (const lang of ["uk", "en"] as const) {
      const { open, close } = prerenderMarkers(lang);
      expect(blocks).toContain(open);
      expect(blocks).toContain(close);
      expect(blocks.indexOf(open)).toBeLessThan(blocks.indexOf(close));
    }
  });
});
