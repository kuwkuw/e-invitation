// Discoverability metadata: what a crawler is told about every page this
// server hands out (adr-016).
//
// The SPA ships one `index.html`, so **every route starts life as the same
// document** — one `<title>`, one description, one `og:*` set. That is fine for
// a browser, which then runs the app, and wrong for everything that does not:
// a search crawler, a messenger unfurling a share link, a preview card in a
// group chat. This module is the single place that says what each path's head
// should contain, and `app.ts` / `routes/og.ts` are the two callers that swap
// it into the shell before sending it.
//
// **Replacement, not appending, is the whole design.** `og:title` is
// first-one-wins in every unfurler that matters, so a shell carrying the
// landing page's card plus an appended invitation card would unfurl every
// share link as the marketing page — FR-3.5 gone, with nothing in the logs.
// The shell marks its default block with `<!--seo:start-->`/`<!--seo:end-->`
// and callers replace what is between them.

import type { Language } from "./schemas.js";

/** Product name as it appears to a crawler, a share card and an inbox. Matches
 *  the wordmark in `email/strings.ts` and `unsubscribePage.ts` — the landing
 *  page's "Запрошення"/"Zaproshennya" is a translated headline, not the name
 *  a search result should carry. */
export const SITE_NAME = "INVINTO";

/** 1200×630, the same canvas the per-invitation card uses (`og/render.ts`).
 *  Static and committed rather than rendered: the marketing card never varies,
 *  so a build artifact beats a satori render on every crawl. */
export const SITE_IMAGE_PATH = "/og-cover.png";
export const SITE_IMAGE_WIDTH = 1200;
export const SITE_IMAGE_HEIGHT = 630;

/** The origin baked into the committed `web/index.html` — the one every
 *  request then overrides with its own (`CANONICAL_HOST`, a preview
 *  deployment, localhost). A shell has to name *some* origin: `og:image` and
 *  `canonical` are required to be absolute, and the file is written long
 *  before a request exists. `test/seo.test.ts` pins the committed block to
 *  what this module generates for it, so the two cannot drift. */
export const DEFAULT_ORIGIN = "https://invinto.app";

export const SEO_MARKER_START = "<!--seo:start-->";
export const SEO_MARKER_END = "<!--seo:end-->";

/** `index,follow` for the one page written to be found; `noindex` for the
 *  three that are an application, someone's private event, or a host's
 *  dashboard. `follow` is kept wherever the page legitimately links onward. */
export type Robots = "index, follow" | "noindex, follow" | "noindex, nofollow";

export interface PageStrings {
  title: string;
  description: string;
}

/** The pages a crawler can reach without a token. `guest` copy comes from the
 *  invitation itself (`routes/og.ts`), so it is not here. */
export type ShellPage = "landing" | "create" | "manage" | "notFound";

// Search copy, not UI copy — it is written for a result listing rather than
// for the page, which is why it names the occasions ("весілля", "день
// народження") the landing headline deliberately does not. Ukrainian first:
// it is the primary market (01-vision), and the shell it is baked into is the
// one an unparameterised `/` serves.
export const SEO_STRINGS: Record<Language, Record<ShellPage, PageStrings>> = {
  uk: {
    landing: {
      title: `${SITE_NAME} — електронні запрошення онлайн за одне речення`,
      description:
        "Опишіть подію одним реченням — отримайте готове запрошення на весілля, " +
        "день народження чи корпоратив, поділіться посиланням і збирайте відповіді гостей.",
    },
    create: {
      title: `Створити запрошення — ${SITE_NAME}`,
      description:
        "Опишіть подію своїми словами — редактор напише текст, підбере дизайн " +
        "і дасть посилання для гостей із підтвердженням присутності.",
    },
    manage: {
      title: `Відповіді гостей — ${SITE_NAME}`,
      description: "Хто прийде на вашу подію — відповіді гостей на ваше запрошення.",
    },
    notFound: {
      title: `Сторінку не знайдено — ${SITE_NAME}`,
      description: "Такої сторінки немає. Створіть запрошення на головній.",
    },
  },
  en: {
    landing: {
      title: `${SITE_NAME} — online invitations with RSVP, from one sentence`,
      description:
        "Describe your event in one sentence and get a ready-made invitation for a wedding, " +
        "birthday or party. Share the link in any messenger and collect guest replies.",
    },
    create: {
      title: `Create an invitation — ${SITE_NAME}`,
      description:
        "Describe your event in your own words — the editor writes the copy, picks a design, " +
        "and gives you a share link that collects RSVPs.",
    },
    manage: {
      title: `Guest replies — ${SITE_NAME}`,
      description: "Who is coming to your event — the replies to your invitation.",
    },
    notFound: {
      title: `Page not found — ${SITE_NAME}`,
      description: "There is no such page. Start an invitation from the home page.",
    },
  },
};

export interface HeadMeta {
  lang: Language;
  title: string;
  description: string;
  robots: Robots;
  /** `<link rel="canonical">`, or null. Null on every `noindex` page: Google
   *  reads noindex + canonical as contradictory instructions about the same
   *  URL, and the page that must not be indexed has no ranking to consolidate. */
  canonical: string | null;
  /** `og:url` — where a card links back to. Separate from `canonical` because
   *  the two answer different questions: an invitation page is `noindex` and
   *  still has one correct address for a share card to point at. */
  url: string | null;
  image: string;
  imageWidth: number;
  imageHeight: number;
  /** `hreflang` → absolute URL. Empty on pages that exist in one language. */
  alternates: { hreflang: string; href: string }[];
  /** Serialized JSON-LD, or null. Only the landing page carries any. */
  jsonLd: string | null;
}

/** `&` first, or the escaping escapes its own output. `'` is left alone: every
 *  value here lands in a double-quoted attribute, and apostrophes are ordinary
 *  characters in Ukrainian copy ("П'ятниця") that a card should show as typed. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** JSON-LD sits in a `<script>`, where HTML escaping does not apply and the
 *  only sequence that can end the element early is `</`. */
function escapeJsonLd(json: string): string {
  return json.replaceAll("<", "\\u003c");
}

/** The languages the shell can be built for. Mirrors `Language` in
 *  `schemas.ts`; `OG_LOCALES` below is keyed by it, so a third language fails
 *  to compile there rather than silently going unstripped here. */
const LANGUAGES = ["uk", "en"] as const satisfies readonly Language[];

const OG_LOCALES: Record<Language, string> = { uk: "uk_UA", en: "en_US" };

/** The head block for one page: the tags a crawler reads and the tags a
 *  messenger unfurls, in one list, in a stable order. */
export function headTags(meta: HeadMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<meta name="robots" content="${meta.robots}">`,
  ];
  if (meta.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);
  for (const alternate of meta.alternates) {
    tags.push(
      `<link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeHtml(alternate.href)}">`,
    );
  }
  tags.push(
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="${OG_LOCALES[meta.lang]}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}">`,
    `<meta property="og:image:width" content="${meta.imageWidth}">`,
    `<meta property="og:image:height" content="${meta.imageHeight}">`,
  );
  if (meta.url) tags.push(`<meta property="og:url" content="${escapeHtml(meta.url)}">`);
  tags.push(
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${escapeHtml(meta.image)}">`,
  );
  if (meta.jsonLd) {
    tags.push(`<script type="application/ld+json">${escapeJsonLd(meta.jsonLd)}</script>`);
  }
  return tags.join("\n    ");
}

/** Swap the shell's default head block for this page's.
 *
 *  The replacement argument is a **function** on purpose. With a string,
 *  `String.replace` expands `$&`, `` $` ``, `$'` and `$1` inside it — after
 *  escaping has run — so a host whose invitation title contains `$&` (copy is
 *  directly editable, FR-2.1) would get the matched shell block injected into
 *  their own meta tag. A replacer's return value is used verbatim.
 *
 *  A shell without the markers still gets its tags, appended before `</head>`:
 *  the markers are an optimisation for correctness, not a precondition, and a
 *  build that lost them should degrade to duplicate tags rather than to none. */
export function replaceSeoBlock(html: string, tags: string): string {
  const start = html.indexOf(SEO_MARKER_START);
  const end = html.indexOf(SEO_MARKER_END);
  if (start === -1 || end === -1 || end < start) {
    return html.replace("</head>", () => `    ${tags}\n  </head>`);
  }
  return html.slice(0, start) + tags + html.slice(end + SEO_MARKER_END.length);
}

/** The shell is written `<html lang="uk">`; a page served in the other
 *  language has to say so, for a crawler and for a screen reader alike. */
export function replaceHtmlLang(html: string, lang: Language): string {
  return html.replace(
    /<html([^>]*)\slang="[^"]*"/i,
    (_match, rest: string) => `<html${rest} lang="${lang}"`,
  );
}

// ---------------------------------------------------------------------------
// Per-path resolution
// ---------------------------------------------------------------------------

/** The one page written to be found, in the one language a bare `/` serves,
 *  plus its counterpart. `?lang=` is how the other language gets an address of
 *  its own: the UI toggle is a client-side preference, and a preference is not
 *  something a crawler can hold, so without a URL the English site would be
 *  unindexable. `uk` is the parameterless form — the primary market gets the
 *  clean URL and the `x-default`. */
export function landingAlternates(base: string): { hreflang: string; href: string }[] {
  return [
    { hreflang: "uk", href: `${base}/` },
    { hreflang: "en", href: `${base}/?lang=en` },
    { hreflang: "x-default", href: `${base}/` },
  ];
}

/** `?lang=` narrowed to the two languages that exist. Anything else is the
 *  default — a typo in a query string must not produce a third variant of the
 *  home page for a crawler to find. */
export function langFromQuery(search: string | null | undefined): Language {
  return search === "en" ? "en" : "uk";
}

function landingJsonLd(base: string, lang: Language): string {
  const strings = SEO_STRINGS[lang].landing;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: `${base}/`,
        name: SITE_NAME,
        description: strings.description,
        inLanguage: ["uk", "en"],
      },
      {
        "@type": "WebApplication",
        "@id": `${base}/#app`,
        name: SITE_NAME,
        url: `${base}/`,
        description: strings.description,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript.",
        inLanguage: ["uk", "en"],
        isPartOf: { "@id": `${base}/#website` },
        // Free today, and stated rather than omitted: a price node is what
        // makes the listing eligible to say so. 07-monetization is an open
        // investigation — when it closes, this is one of the things it moves.
        offers: { "@type": "Offer", price: "0", priceCurrency: "UAH" },
      },
    ],
  });
}

/** Head metadata for a path the SPA shell answers. `path` is the pathname
 *  alone and `search` the raw query string, both as `app.ts` splits them. */
export function shellMeta(path: string, search: string, base: string): HeadMeta {
  const params = new URLSearchParams(search);
  const lang = langFromQuery(params.get("lang"));
  const image = `${base}${SITE_IMAGE_PATH}`;
  const common = {
    lang,
    image,
    imageWidth: SITE_IMAGE_WIDTH,
    imageHeight: SITE_IMAGE_HEIGHT,
    alternates: [] as { hreflang: string; href: string }[],
    jsonLd: null as string | null,
  };

  if (path === "/") {
    // `?lang=uk` and `/` are the same page, so the canonical is the clean form
    // either way — otherwise the home page competes with itself.
    const canonical = lang === "en" ? `${base}/?lang=en` : `${base}/`;
    return {
      ...common,
      ...SEO_STRINGS[lang].landing,
      robots: "index, follow",
      canonical,
      url: canonical,
      alternates: landingAlternates(base),
      jsonLd: landingJsonLd(base, lang),
    };
  }

  // The editor is the product, not a document: it renders nothing until the
  // app boots and has nothing a search result could usefully quote. Indexing
  // it would put a blank shell in front of searchers and split the home page's
  // ranking with a page that says less. `follow` because its own links are
  // real — this is a page we decline to list, not one we distrust.
  if (path === "/create") {
    return {
      ...common,
      ...SEO_STRINGS[lang].create,
      robots: "noindex, follow",
      canonical: null,
      url: null,
    };
  }

  // Someone's guest list. `nofollow` as well: the links out of it are that
  // host's own invitation and manage URLs.
  if (path.startsWith("/manage/")) {
    return {
      ...common,
      ...SEO_STRINGS[lang].manage,
      robots: "noindex, nofollow",
      canonical: null,
      url: null,
    };
  }

  // Unknown paths render the landing component (AppRoutes `*`), which is a
  // kindness to a person and a trap for a crawler: every typo'd URL would be a
  // duplicate of the home page. No canonical either — pointing them at `/`
  // would ask for exactly the consolidation `noindex` just declined.
  return {
    ...common,
    ...SEO_STRINGS[lang].notFound,
    robots: "noindex, follow",
    canonical: null,
    url: null,
  };
}

// ---------------------------------------------------------------------------
// robots.txt and sitemap.xml
// ---------------------------------------------------------------------------

/** Crawl policy. Generated rather than shipped as a static file because the
 *  `Sitemap:` line has to be absolute, and the origin is only known at request
 *  time (`CANONICAL_HOST`, a preview deployment, localhost).
 *
 *  The `Allow` line above `Disallow: /api/` is the load-bearing one.
 *  `facebookexternalhit`, `Twitterbot` and Telegram's fetcher all honour
 *  robots.txt, and the share card's image is served from
 *  `/api/invitations/:id/og.png` — a blanket `/api` disallow would stop every
 *  published link unfurling (FR-3.5) with nothing in the logs to say why.
 *  `Allow` precedes `Disallow` for the parsers that take the first match
 *  rather than the longest.
 *
 *  `/i/` is deliberately **not** disallowed. Those pages must not be indexed —
 *  they carry a host's date, venue and guests — but that is `noindex`'s job
 *  (`routes/og.ts`), and `noindex` needs the page to be fetched to be read.
 *  Disallowing the path would block the unfurl crawlers instead of the search
 *  index: the one privacy control that costs the product its only distribution
 *  channel. */
export function robotsTxt(base: string): string {
  return [
    "User-agent: *",
    "Allow: /api/invitations/*/og.png",
    "Disallow: /api/",
    "Disallow: /manage/",
    "Disallow: /unsubscribe/",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}

/** Two URLs, because the site has two languages and one page worth listing.
 *  Every URL in an hreflang set repeats the whole set — a sitemap that names
 *  the alternates only on one of them describes a one-way relationship, which
 *  Google discards. */
export function sitemapXml(base: string): string {
  const alternates = landingAlternates(base)
    .map(
      (a) =>
        `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeHtml(a.href)}"/>`,
    )
    .join("\n");
  const url = (loc: string, priority: string) =>
    [
      "  <url>",
      `    <loc>${escapeHtml(loc)}</loc>`,
      alternates,
      "    <changefreq>weekly</changefreq>",
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    url(`${base}/`, "1.0"),
    url(`${base}/?lang=en`, "0.8"),
    "</urlset>",
    "",
  ].join("\n");
}

/** Keep one language's prerendered landing copy, drop the rest.
 *
 *  The built shell carries the landing page's copy as real HTML inside `#root`,
 *  once per language (adr-016 §10, `web/src/prerender.ts`). Exactly one of
 *  those is right for any given request and the others are worse than nothing:
 *  a guest opening a share link would watch the marketing hero sit there until
 *  React replaced it with their invitation.
 *
 *  `null` strips both, which is every path that is not the landing page. A
 *  shell built without the plugin has no markers and comes back untouched. */
export function selectPrerender(html: string, lang: Language | null): string {
  let out = html;
  for (const candidate of LANGUAGES) {
    const open = `<!--pre:${candidate}-->`;
    const close = `<!--/pre:${candidate}-->`;
    const start = out.indexOf(open);
    if (start === -1) continue;
    const end = out.indexOf(close, start);
    if (end === -1) continue;
    // Unwrapped (markers removed, copy kept) or excised entirely. Slicing
    // rather than `String.replace`, so no `$` sequence in a headline can
    // expand into the surrounding markup.
    const inner = candidate === lang ? out.slice(start + open.length, end) : "";
    out = out.slice(0, start) + inner + out.slice(end + close.length);
  }
  return out;
}

/** Which language's landing copy this path should ship, if any. Only `/` has
 *  any: it is the one page written to be read before the app boots. */
export function prerenderLanguage(path: string, lang: Language): Language | null {
  return path === "/" ? lang : null;
}

/** The shell, dressed for one page: head block swapped in, `<html lang>`
 *  corrected, and the prerendered body kept or stripped. The two callers — the
 *  SPA fallback and `/i/:id` — differ in where their `HeadMeta` comes from and
 *  in whether they want a prerender; a guest page never does, which is why the
 *  parameter defaults to none. */
export function renderShell(
  html: string,
  meta: HeadMeta,
  prerender: Language | null = null,
): string {
  const dressed = replaceHtmlLang(replaceSeoBlock(html, headTags(meta)), meta.lang);
  return selectPrerender(dressed, prerender);
}
