import {
  GALLERY_DESIGNS,
  type GalleryExample,
  galleryFor,
  OCCASION_IDS,
  type OccasionId,
  populatedOccasions,
} from "./gallery";
import { GALLERY, LANDING } from "./i18n";
import type { DesignTokens, Language } from "./types";

// Build-time only (adr-016 §10). `vite.config.ts` imports this and nothing
// else does — **never import it from client code**, where it would be dead
// weight in the bundle.
//
// The problem it solves: the SPA's body is `<div id="root"></div>` and nothing
// else, so a crawler that does not run JavaScript sees a page with a title, a
// description and no content. Google does render JS, but rendering is a second,
// queued pass that lags crawling and gets the least budget on exactly the kind
// of domain this is — new, with no inbound links. Bing is weaker at it again.
//
// So the landing page — the one page written to be found — ships its copy as
// real HTML inside the root container. React discards those children on its
// first render (`createRoot` replaces the container's contents), so this is not
// hydration and does not have to match what React would produce: it has to say
// the same things, in the same classes, so the swap is invisible.
//
// Generated from `LANDING` rather than written out, which is the whole point:
// the copy has exactly one source, and marketing edits cannot leave a stale
// second copy behind the way a hand-mirrored block would.

/** One block per (page × language) goes into the shell, and the server keeps
 *  the one the request asked for (`selectPrerender` in `server/src/seo.ts`).
 *  The alternative — a shell per page per language — would mean fourteen build
 *  outputs for a difference of a few kilobytes.
 *
 *  Keys are `<page>:<lang>` — `landing:uk`, `gallery:en`,
 *  `gallery-wedding:uk`. `server/src/seo.ts` builds the same strings in
 *  `prerenderKey`; the two are mirrored by hand, and its scanning regex
 *  expects exactly this shape. */
export const prerenderMarkers = (key: string) => ({
  open: `<!--pre:${key}-->`,
  close: `<!--/pre:${key}-->`,
});

/** These are developer-authored strings, not user input, so this is hygiene
 *  rather than a control — but landing copy is full of «», — and apostrophes,
 *  and one `&` in a future edit should not be able to produce broken markup. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The landing page's copy as static HTML, in the same class names
 * `LandingPage.tsx` renders, so what a visitor sees before React mounts is
 * what they see after.
 *
 * Deliberately a **subset**. Left out: the hero's three sample invitations
 * (decorative, `aria-hidden`, and a large amount of markup for no text), the
 * step glyphs (decoration with no reading), the mocked RSVP rows and the
 * returning-host list (that one is per-visitor and belongs to nobody until the
 * app boots). What is kept is every heading, every line of prose and the
 * occasion words — which is to say, everything a search result could quote.
 *
 * The calls to action are real `<a href="/create">` links rather than the
 * page's `<button>`s. A crawler cannot press a button, so today the editor is
 * reachable from the landing page only by rendering it; this gives the crawl a
 * real edge to follow, and React swaps the buttons back in on mount.
 */
export function landingBodyHtml(lang: Language): string {
  const t = LANDING[lang];
  const cta = `<a class="lp-cta" href="/create">${escapeHtml(t.cta)}</a>`;
  const steps = t.steps
    .map(
      (step) =>
        `<div class="lp-step">` +
        `<div class="lp-step-title">${escapeHtml(step.title)}</div>` +
        `<div class="lp-step-text">${escapeHtml(step.text)}</div>` +
        `</div>`,
    )
    .join("");
  const chips = t.chips.map((chip) => `<span class="lp-chip">${escapeHtml(chip)}</span>`).join("");

  return (
    `<div class="landing">` +
    `<header class="lp-nav"><span class="lp-brand">` +
    `<span class="lp-brand-full">${escapeHtml(t.brand)}</span>` +
    `</span></header>` +
    `<section class="lp-hero"><div class="lp-hero-copy">` +
    `<h1>${escapeHtml(t.heroTitle)}</h1>` +
    `<p>${escapeHtml(t.heroText)}</p>` +
    cta +
    `</div></section>` +
    `<section class="lp-steps"><h2>${escapeHtml(t.howTitle)}</h2>` +
    `<div class="lp-steps-grid">${steps}</div></section>` +
    `<section class="lp-chips">${chips}</section>` +
    `<section class="lp-rsvp"><div class="lp-rsvp-inner"><div class="lp-rsvp-copy">` +
    `<h2>${escapeHtml(t.rsvpTitle)}</h2>` +
    `<p>${escapeHtml(t.rsvpText)}</p>` +
    `</div></div></section>` +
    `<section class="lp-final"><h2>${escapeHtml(t.finalTitle)}</h2>${cta}</section>` +
    `<footer class="lp-footer">${escapeHtml(t.footer)}</footer>` +
    `</div>`
  );
}

/** One gallery example, as a crawler sees it (adr-017 §2).
 *
 *  The invitation's text is real markup, not an image: a gallery of pictures is
 *  an empty page for search, and these pages exist to be found. Class names and
 *  element types are copied from `InvitationPreview.tsx` so React's swap on
 *  mount is invisible — the ornament is an empty div the CSS draws, not a glyph
 *  in the markup.
 *
 *  The call to action is a real `<a href>`: a crawler cannot press a button,
 *  and a full page load is what makes `?sample=` reload-safe. */
function exampleHtml(example: GalleryExample, design: DesignTokens, useLabel: string): string {
  const card =
    `<div class="inv palette-${design.palette} type-${design.typography} ` +
    `layout-${design.layout} ornament-${design.ornament}">` +
    `<div class="inv-ornament"></div>` +
    `<h2 class="inv-title">${escapeHtml(example.copy.title)}</h2>` +
    `<p class="inv-greeting">${escapeHtml(example.copy.greeting)}</p>` +
    `<p class="inv-body">${escapeHtml(example.copy.body)}</p>` +
    `<p class="inv-details">${escapeHtml(example.copy.details_line)}</p>` +
    `<p class="inv-rsvp">${escapeHtml(example.copy.rsvp_prompt)}</p>` +
    `<p class="inv-closing">${escapeHtml(example.copy.closing)}</p>` +
    `</div>`;
  return (
    `<article class="gl-example">${card}` +
    `<div class="gl-example-foot"><div>` +
    `<div class="gl-example-style">${escapeHtml(example.style)}</div>` +
    `<div class="gl-example-note">${escapeHtml(example.styleNote)}</div>` +
    `</div>` +
    `<a class="gl-use" href="/create?sample=${encodeURIComponent(example.id)}">` +
    `${escapeHtml(useLabel)}</a>` +
    `</div></article>`
  );
}

/** `/gallery/:occasion` — the page written to rank. */
export function galleryOccasionBodyHtml(occasion: OccasionId, lang: Language): string {
  const t = GALLERY[lang];
  // An example with no design tokens is skipped rather than asserted past:
  // `gallery.test.ts` holds that none exist, and a missing one should cost a
  // card rather than the whole build.
  const examples = galleryFor(occasion, lang)
    .flatMap((example) => {
      const design = GALLERY_DESIGNS[example.id];
      return design ? [exampleHtml(example, design, t.use)] : [];
    })
    .join("");
  const others = populatedOccasions(lang)
    .filter((other) => other !== occasion)
    .map(
      (other) =>
        `<a class="gl-chip" href="/gallery/${other}">${escapeHtml(t.occasions[other])}</a>`,
    )
    .join("");

  return (
    `<div class="gl">` +
    `<nav class="gl-crumbs">` +
    `<a href="/">${escapeHtml(t.home)}</a>` +
    `<a href="/gallery">${escapeHtml(t.hubTitle)}</a>` +
    `<span>${escapeHtml(t.occasions[occasion])}</span>` +
    `</nav>` +
    `<h1>${escapeHtml(t.occasionTitle[occasion])}</h1>` +
    `<p class="gl-intro">${escapeHtml(t.occasionIntro[occasion])}</p>` +
    `<div class="gl-examples">${examples}</div>` +
    `<section class="gl-others"><h2>${escapeHtml(t.otherOccasions)}</h2>` +
    `<div class="gl-chips">${others}</div></section>` +
    `</div>`
  );
}

/** `/gallery` — the hub. A crawl path to the six occasion pages, and a way for
 *  a visitor to pick theirs. No filled accent anywhere: the tile is the link. */
export function galleryHubBodyHtml(lang: Language): string {
  const t = GALLERY[lang];
  const tiles = populatedOccasions(lang)
    .map((occasion) => {
      // `populatedOccasions` only yields occasions with at least one example,
      // so the first is always there — but the index signature does not know
      // that, and an empty title is a better failure than a build crash.
      const first = galleryFor(occasion, lang)[0];
      return (
        `<a class="gl-tile" href="/gallery/${occasion}">` +
        `<span class="gl-tile-name">${escapeHtml(t.occasions[occasion])}</span>` +
        `<span class="gl-tile-sample">${escapeHtml(first?.copy.title ?? "")}</span>` +
        `</a>`
      );
    })
    .join("");

  return (
    `<div class="gl">` +
    `<h1>${escapeHtml(t.hubTitle)}</h1>` +
    `<p class="gl-intro">${escapeHtml(t.hubIntro)}</p>` +
    `<div class="gl-tiles">${tiles}</div>` +
    `</div>`
  );
}

/** Every prerendered block: the landing page, the gallery hub and each
 *  occasion, in both languages (adr-017 §6). The server keeps one
 *  (`prerenderKey` + `selectPrerender`) and strips the rest. */
export function prerenderBlocks(): string {
  const parts: string[] = [];
  for (const lang of ["uk", "en"] as const) {
    const wrap = (key: string, body: string) => {
      const { open, close } = prerenderMarkers(key);
      parts.push(`${open}${body}${close}`);
    };
    wrap(`landing:${lang}`, landingBodyHtml(lang));
    wrap(`gallery:${lang}`, galleryHubBodyHtml(lang));
    for (const occasion of OCCASION_IDS) {
      wrap(`gallery-${occasion}:${lang}`, galleryOccasionBodyHtml(occasion, lang));
    }
  }
  return parts.join("");
}
