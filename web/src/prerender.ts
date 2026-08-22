import { LANDING } from "./i18n";
import type { Language } from "./types";

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

/** Two blocks go into the shell, one per language, and the server keeps the
 *  one the request asked for (`selectPrerender` in `server/src/seo.ts`). The
 *  alternative — a shell per language — would mean two build outputs for a
 *  difference of about a kilobyte. */
export const prerenderMarkers = (lang: Language) => ({
  open: `<!--pre:${lang}-->`,
  close: `<!--/pre:${lang}-->`,
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

/** Both languages, each in its markers, for the shell's root container. */
export function landingPrerenderBlocks(): string {
  return (["uk", "en"] as const)
    .map((lang) => {
      const { open, close } = prerenderMarkers(lang);
      return `${open}${landingBodyHtml(lang)}${close}`;
    })
    .join("");
}
