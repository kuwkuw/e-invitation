import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Invitation } from "../src/schemas.js";
import {
  DEFAULT_ORIGIN,
  GALLERY_OCCASIONS,
  headTags,
  isGalleryOccasion,
  prerenderLanguage,
  replaceHtmlLang,
  replaceSeoBlock,
  robotsTxt,
  SEO_MARKER_END,
  SEO_MARKER_START,
  SITE_IMAGE_PATHS,
  selectPrerender,
  shellMeta,
  sitemapXml,
} from "../src/seo.js";

const BASE = "https://invinto.app";
/** The landing hero, as `web/src/i18n.ts` has it. Named once here because the
 *  server workspace cannot import the client's copy — the point of the test is
 *  that this string reaches the served body at all, not what it says. */
const LANDING_UK_HERO = "Запрошення за одне речення";

describe("shellMeta", () => {
  it("indexes the landing page and points it at itself", () => {
    const meta = shellMeta("/", "", BASE);
    expect(meta.lang).toBe("uk");
    expect(meta.robots).toBe("index, follow");
    expect(meta.canonical).toBe(`${BASE}/`);
    expect(meta.url).toBe(`${BASE}/`);
    expect(meta.title).toContain("INVINTO");
    expect(meta.jsonLd).toContain("WebApplication");
  });

  // The UI toggle is a client-side preference and a crawler holds none, so
  // without a URL of its own the English site is unindexable (adr-016 §5).
  it("serves the English landing page under ?lang=en", () => {
    const meta = shellMeta("/", "lang=en", BASE);
    expect(meta.lang).toBe("en");
    expect(meta.title).toBe("INVINTO — online invitations with RSVP, from one sentence");
    expect(meta.canonical).toBe(`${BASE}/?lang=en`);
  });

  // Two addresses for one page would make the home page compete with itself.
  it("canonicalises ?lang=uk back to the bare path", () => {
    expect(shellMeta("/", "lang=uk", BASE).canonical).toBe(`${BASE}/`);
    // And an unknown value is not a third variant.
    expect(shellMeta("/", "lang=de", BASE).canonical).toBe(`${BASE}/`);
    expect(shellMeta("/", "lang=de", BASE).lang).toBe("uk");
  });

  it("declares both languages as alternates of each other", () => {
    for (const search of ["", "lang=en"]) {
      expect(shellMeta("/", search, BASE).alternates).toEqual([
        { hreflang: "uk", href: `${BASE}/` },
        { hreflang: "en", href: `${BASE}/?lang=en` },
        { hreflang: "x-default", href: `${BASE}/` },
      ]);
    }
  });

  // noindex + canonical is a contradiction Google resolves by guessing, so
  // every page that refuses indexing names no canonical either.
  it.each([
    ["/create", "noindex, follow"],
    ["/manage/abc123xy", "noindex, nofollow"],
    ["/nonsense", "noindex, follow"],
  ] as const)("keeps %s out of the index with no canonical", (path, robots) => {
    const meta = shellMeta(path, "", BASE);
    expect(meta.robots).toBe(robots);
    expect(meta.canonical).toBeNull();
    expect(meta.url).toBeNull();
    expect(meta.jsonLd).toBeNull();
  });

  // The card is copy, and a share link is how the landing page mostly travels:
  // an English page unfurling a Ukrainian headline sends the one page written
  // for English readers into a chat in a script they followed a link to avoid.
  it("unfurls each language with its own share card", () => {
    expect(shellMeta("/", "", BASE).image).toBe(`${BASE}${SITE_IMAGE_PATHS.uk}`);
    expect(shellMeta("/", "lang=en", BASE).image).toBe(`${BASE}${SITE_IMAGE_PATHS.en}`);
    expect(SITE_IMAGE_PATHS.uk).not.toBe(SITE_IMAGE_PATHS.en);
  });

  // Both files are committed build artifacts (adr-016 §3) — a path here with
  // no PNG behind it unfurls as a broken image on every share, silently.
  it("has a committed PNG behind every card path", () => {
    for (const path of Object.values(SITE_IMAGE_PATHS)) {
      expect(existsSync(join(import.meta.dirname, "../../web/public", path))).toBe(true);
    }
  });

  it("gives each shell route its own title", () => {
    const titles = ["/", "/create", "/manage/abc123xy", "/nonsense"].map(
      (path) => shellMeta(path, "", BASE).title,
    );
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("head block replacement", () => {
  const shell = `<!doctype html>\n<html lang="uk">\n  <head>\n    ${SEO_MARKER_START}<title>default</title>${SEO_MARKER_END}\n  </head>\n</html>`;

  it("replaces the marked block rather than appending to it", () => {
    const html = replaceSeoBlock(shell, "<title>replaced</title>");
    expect(html).toContain("<title>replaced</title>");
    // The property that keeps share links unfurling as themselves: og:title is
    // first-one-wins, so the shell's default must be gone, not merely followed.
    expect(html).not.toContain("<title>default</title>");
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  // Copy is host-controlled (FR-2.1) and reaches these tags. A string
  // replacement would expand `$&` and friends *after* escaping, injecting the
  // matched text into the host's own meta tag.
  it("does not expand $-sequences in the replacement", () => {
    const tags = `<title>$& $\` $' $1 $$</title>`;
    expect(replaceSeoBlock(shell, tags)).toContain(tags);
  });

  // A build that lost the markers should degrade to duplicate tags, not none.
  it("falls back to injecting before </head> when the markers are gone", () => {
    const unmarked = `<!doctype html>\n<html lang="uk">\n  <head>\n  </head>\n</html>`;
    expect(replaceSeoBlock(unmarked, "<title>x</title>")).toContain("<title>x</title>");
  });

  it("rewrites the document language", () => {
    expect(replaceHtmlLang(shell, "en")).toContain('<html lang="en">');
    expect(replaceHtmlLang('<html lang="uk" data-x="1">', "en")).toContain('lang="en"');
  });
});

// The landing page ships its copy as real HTML in the body (adr-016 §10),
// once per language, and exactly one of those is right for any request. The
// others are worse than nothing: a guest opening a share link would watch the
// marketing hero sit there until React replaced it with their invitation.
describe("prerendered landing copy", () => {
  const shell = `<div id="root"><!--pre:uk-->ВІТАЄМО<!--/pre:uk--><!--pre:en-->WELCOME<!--/pre:en--></div>`;

  it("keeps the language asked for and drops the other", () => {
    expect(selectPrerender(shell, "uk")).toBe('<div id="root">ВІТАЄМО</div>');
    expect(selectPrerender(shell, "en")).toBe('<div id="root">WELCOME</div>');
  });

  it("strips every block when no language is asked for", () => {
    expect(selectPrerender(shell, null)).toBe('<div id="root"></div>');
  });

  // A shell built without the Vite plugin has no markers at all.
  it("leaves a shell without markers alone", () => {
    const bare = '<div id="root"></div>';
    expect(selectPrerender(bare, "uk")).toBe(bare);
  });

  // Slicing rather than String.replace, so no `$` sequence in a headline can
  // expand into the surrounding markup.
  it("does not expand $-sequences in the kept copy", () => {
    const dollars = `<div id="root"><!--pre:uk-->$& $\` $' $1 $$<!--/pre:uk--></div>`;
    expect(selectPrerender(dollars, "uk")).toBe(`<div id="root">$& $\` $' $1 $$</div>`);
  });

  it("prerenders the landing page and nothing else", () => {
    expect(prerenderLanguage("/", "uk")).toBe("uk");
    expect(prerenderLanguage("/", "en")).toBe("en");
    for (const path of ["/create", "/manage/abc123xy", "/i/abc123xy", "/nonsense"]) {
      expect(prerenderLanguage(path, "uk")).toBeNull();
    }
  });
});

// The shell is written once and served forever, so its committed head has to
// be the one the server would have generated for `/`. Pinning it here is what
// keeps a copy edit in seo.ts from leaving a stale title in the file every
// crawler reads first.
describe("the committed shell", () => {
  const html = readFileSync(join(process.cwd(), "..", "web", "index.html"), "utf8");

  it("carries the landing page's generated head block", () => {
    const start = html.indexOf(SEO_MARKER_START) + SEO_MARKER_START.length;
    const end = html.indexOf(SEO_MARKER_END);
    expect(start).toBeGreaterThan(SEO_MARKER_START.length - 1);
    expect(html.slice(start, end)).toBe(headTags(shellMeta("/", "", DEFAULT_ORIGIN)));
  });

  it("declares the icons and manifest the head block does not", () => {
    expect(html).toContain('rel="icon"');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
  });
});

describe("robots.txt", () => {
  const txt = robotsTxt(BASE);

  it("names the sitemap absolutely", () => {
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });

  // facebookexternalhit, Twitterbot and Telegram's fetcher all honour
  // robots.txt, and the share card's image is served from under /api. A
  // blanket disallow would stop every published link unfurling (FR-3.5).
  it("allows the OG image out of the otherwise-closed /api", () => {
    const allow = txt.indexOf("Allow: /api/invitations/*/og.png");
    const disallow = txt.indexOf("Disallow: /api/");
    expect(allow).toBeGreaterThan(-1);
    // Before, for the parsers that take the first match rather than the longest.
    expect(allow).toBeLessThan(disallow);
  });

  // Guest pages must not be *indexed*, which is noindex's job — and noindex
  // has to be fetched to be read. Disallowing /i/ would block the unfurlers
  // instead of the index: the one control that costs the product its only
  // distribution channel.
  it("leaves guest pages crawlable so their noindex can be read", () => {
    expect(txt).not.toContain("Disallow: /i/");
  });

  it("closes the host's own surfaces", () => {
    expect(txt).toContain("Disallow: /manage/");
    expect(txt).toContain("Disallow: /unsubscribe/");
  });
});

describe("sitemap.xml", () => {
  const xml = sitemapXml(BASE);

  it("lists both languages of the one page worth listing", () => {
    expect(xml).toContain(`<loc>${BASE}/</loc>`);
    expect(xml).toContain(`<loc>${BASE}/?lang=en</loc>`);
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });

  // An hreflang relationship Google accepts is reciprocal: every URL in the
  // set repeats the whole set.
  it("repeats the full alternate set on both URLs", () => {
    expect(xml.match(/hreflang="en"/g)).toHaveLength(2);
    expect(xml.match(/hreflang="x-default"/g)).toHaveLength(2);
  });

  it("lists nothing the crawl policy closes", () => {
    for (const path of ["/create", "/manage/", "/i/", "/unsubscribe/"]) {
      expect(xml).not.toContain(path);
    }
  });
});

describe("seo routes", () => {
  let app: FastifyInstance;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "inv-app-seo-test-"));
    process.env.DATA_DIR = dataDir;
    const { buildApp } = await import("../src/app.js");
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("serves robots.txt as text, ahead of the SPA fallback", async () => {
    const res = await app.inject({ method: "GET", url: "/robots.txt" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("User-agent: *");
  });

  it("serves sitemap.xml as XML", async () => {
    const res = await app.inject({ method: "GET", url: "/sitemap.xml" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.body).toContain("<urlset");
  });

  // Both files carry absolute URLs, which is why they are generated per
  // request rather than shipped as static files: the origin is a deployment
  // fact (CANONICAL_HOST, a preview URL, localhost), not a build-time one.
  it("builds both from the canonical host when one is configured", async () => {
    vi.stubEnv("CANONICAL_HOST", "invinto.app");
    const robots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: { host: "invinto.app" },
    });
    const sitemap = await app.inject({
      method: "GET",
      url: "/sitemap.xml",
      headers: { host: "invinto.app" },
    });
    expect(robots.body).toContain("Sitemap: https://invinto.app/sitemap.xml");
    expect(sitemap.body).toContain("<loc>https://invinto.app/</loc>");
    vi.unstubAllEnvs();
  });
});

// The SPA fallback only dresses the shell when the client has been built next
// to the server, which is how the production image is laid out but not how a
// bare checkout is (see spaShell.test.ts).
const spaBuilt = existsSync(join(process.cwd(), "..", "web", "dist", "index.html"));

describe.skipIf(!spaBuilt)("shell metadata over HTTP", () => {
  let app: FastifyInstance;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "inv-app-seo-shell-test-"));
    process.env.DATA_DIR = dataDir;
    const { buildApp } = await import("../src/app.js");
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  /** What a crawler that never runs the app actually reads: the body with its
   *  scripts and tags stripped out. */
  function bodyWords(html: string): string {
    const body = html.slice(html.indexOf("<body"));
    return body
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  it("serves the landing page indexable, in Ukrainian", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.body).toContain('<meta name="robots" content="index, follow">');
    expect(res.body).toContain('<html lang="uk">');
    expect(res.headers["x-robots-tag"]).toBeUndefined();
  });

  // The failure this closes: a perfect title and description over an empty
  // `<div id="root">`, which is all the shell was before adr-016 §10.
  it("serves the landing copy as readable HTML, not an empty root", async () => {
    const uk = await app.inject({ method: "GET", url: "/" });
    expect(bodyWords(uk.body)).toContain(LANDING_UK_HERO);
    expect(bodyWords(uk.body).split(" ").length).toBeGreaterThan(50);
    // And a real link to the editor, which a `<button>` never gives a crawler.
    expect(uk.body).toContain('href="/create"');

    const en = await app.inject({ method: "GET", url: "/?lang=en" });
    expect(bodyWords(en.body)).toContain("An invitation from one sentence");
    expect(en.body).not.toContain(LANDING_UK_HERO);
  });

  it("gives every other path an empty body to render into", async () => {
    for (const url of ["/create", "/manage/abc123xy", "/nonsense"]) {
      const res = await app.inject({ method: "GET", url });
      expect(bodyWords(res.body)).toBe("");
    }
  });

  it("serves the English landing page under ?lang=en", async () => {
    const res = await app.inject({ method: "GET", url: "/?lang=en" });
    expect(res.body).toContain('<html lang="en">');
    expect(res.body).toContain("online invitations with RSVP");
    // Exactly one — the shell's Ukrainian default is replaced, not joined.
    expect(res.body.match(/<title>/g)).toHaveLength(1);
  });

  it.each(["/create", "/manage/abc123xy", "/nonsense"])(
    "keeps %s out of the index, in the document and in the headers",
    async (url) => {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('name="robots" content="noindex');
      expect(res.body).not.toContain('rel="canonical"');
      expect(res.headers["x-robots-tag"]).toContain("noindex");
    },
  );

  // The failure this prevents: a shell carrying the landing page's card, an
  // invitation's card appended after it, and every share link in every group
  // chat unfurling as the marketing page.
  it("unfurls a share link as the invitation, not as the marketing page", async () => {
    const invitation: Invitation = {
      brief: {
        event_type: "birthday",
        hosts: ["Олена"],
        date: "12 серпня",
        time: "18:00",
        venue: "Кафе «Затишок»",
        city: "Львів",
        tone: "warm",
        language: "uk",
        extra_details: null,
      },
      copy: {
        title: "Запрошення на день народження",
        greeting: "Дорогі друзі!",
        body: "Запрошуємо вас відсвяткувати разом із нами.",
        details_line: "12 серпня, 18:00 — Кафе «Затишок», Львів",
        rsvp_prompt: "Будь ласка, підтвердіть свою присутність.",
        closing: "З любов'ю, Олена",
      },
      design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
    };
    const published = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation },
    });
    const { id } = published.json();

    const page = await app.inject({ method: "GET", url: `/i/${id}` });
    expect(page.body.match(/property="og:title"/g)).toHaveLength(1);
    expect(page.body).toContain(`og:title" content="${invitation.copy.title}"`);
    expect(page.body).not.toContain("INVINTO — електронні запрошення");
    // Shareable and unindexable at once: a guest page carries a host's date,
    // venue and family name, and no unfurler consults `robots`.
    expect(page.body).toContain('name="robots" content="noindex, nofollow"');
    // And no marketing hero underneath it: a guest opening a share link must
    // not watch the landing page sit there until React replaces it.
    expect(page.body).not.toContain(LANDING_UK_HERO);
    expect(bodyWords(page.body)).toBe("");
    expect(page.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(page.body).not.toContain('rel="canonical"');
  });
});

describe("gallery occasions", () => {
  it("lists the six occasions in the order the web mirror uses", () => {
    expect([...GALLERY_OCCASIONS]).toEqual([
      "wedding",
      "birthday",
      "kids",
      "christening",
      "corporate",
      "jubilee",
    ]);
  });

  it("rejects a slug that is not an occasion", () => {
    expect(isGalleryOccasion("wedding")).toBe(true);
    expect(isGalleryOccasion("weddings")).toBe(false);
    expect(isGalleryOccasion("..")).toBe(false);
  });
});
