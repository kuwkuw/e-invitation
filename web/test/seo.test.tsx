import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "../src/LandingPage";
import { forgetHeldManageTokens } from "../src/manageTokens";
import { applyDocumentMeta, langFromSearch, routeMeta } from "../src/seo";

/**
 * Head management after a client-side navigation (adr-016 §6).
 *
 * The server ships each path's head in the shell it serves, which is what a
 * crawler and every messenger unfurler read — they fetch one URL and never
 * navigate. What they cannot cover is the SPA moving between routes under
 * them: without this the tab keeps the landing page's title on `/create`, and
 * `/`'s canonical keeps claiming every screen is the home page.
 */

describe("langFromSearch", () => {
  it("reads the two languages that exist and nothing else", () => {
    expect(langFromSearch("?lang=en")).toBe("en");
    expect(langFromSearch("?lang=uk")).toBe("uk");
    // Absent, so the caller falls back to the stored preference rather than
    // inventing a third variant of the home page for a crawler to find.
    expect(langFromSearch("?lang=de")).toBeNull();
    expect(langFromSearch("")).toBeNull();
    expect(langFromSearch("?ref=guest")).toBeNull();
  });
});

describe("routeMeta", () => {
  it("indexes the landing page and points it at itself", () => {
    const meta = routeMeta("landing", "uk");
    expect(meta.robots).toBe("index, follow");
    expect(meta.canonical).toBe(`${window.location.origin}/`);
    expect(meta.title).toContain("INVINTO");
  });

  // The canonical follows the URL, not the language on screen: a returning
  // visitor whose stored preference is English still reached `/`.
  it("canonicalises by the URL's language, not the rendered one", () => {
    expect(routeMeta("landing", "en", "").canonical).toBe(`${window.location.origin}/`);
    expect(routeMeta("landing", "en", "?lang=en").canonical).toBe(
      `${window.location.origin}/?lang=en`,
    );
    expect(routeMeta("landing", "uk", "?lang=en").canonical).toBe(
      `${window.location.origin}/?lang=en`,
    );
  });

  // noindex + canonical is a contradiction; every page that refuses indexing
  // names no canonical either. Mirrors `shellMeta` on the server.
  it.each([
    ["create", "noindex, follow"],
    ["manage", "noindex, nofollow"],
    ["notFound", "noindex, follow"],
  ] as const)("keeps %s out of the index with no canonical", (page, robots) => {
    const meta = routeMeta(page, "uk");
    expect(meta.robots).toBe(robots);
    expect(meta.canonical).toBeNull();
  });

  it("translates every page", () => {
    for (const page of ["landing", "create", "manage", "notFound"] as const) {
      expect(routeMeta(page, "uk").title).not.toBe(routeMeta(page, "en").title);
    }
  });
});

describe("applyDocumentMeta", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.documentElement.lang = "uk";
  });

  it("writes the title, description, robots and language", () => {
    applyDocumentMeta({
      lang: "en",
      title: "Create an invitation — INVINTO",
      description: "A description.",
      robots: "noindex, follow",
      canonical: null,
    });
    expect(document.title).toBe("Create an invitation — INVINTO");
    expect(document.documentElement.lang).toBe("en");
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "A description.",
    );
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, follow",
    );
  });

  // The shell already carries these tags. Appending to them rather than
  // rewriting them would leave the server's values first and, for a parser
  // that takes the first match, winning.
  it("reuses the shell's tags instead of stacking duplicates", () => {
    document.head.innerHTML =
      '<meta name="description" content="from the shell">' +
      '<meta name="robots" content="index, follow">' +
      '<link rel="canonical" href="https://invinto.app/">';
    const meta = {
      lang: "uk",
      title: "t",
      description: "fresh",
      robots: "index, follow",
      canonical: "https://invinto.app/?lang=en",
    } as const;
    applyDocumentMeta(meta);
    applyDocumentMeta(meta);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "fresh",
    );
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://invinto.app/?lang=en",
    );
  });

  // The navigation this exists for: arrive on `/`, click through to the
  // editor, and `/`'s canonical is still in the head claiming this is the home
  // page. A `noindex` page has to *remove* it, not overwrite it.
  it("removes a stale canonical rather than leaving it pointing elsewhere", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://invinto.app/">';
    applyDocumentMeta({
      lang: "uk",
      title: "t",
      description: "d",
      robots: "noindex, follow",
      canonical: null,
    });
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

// The English landing page's only address (adr-016 §5). The UI toggle is a
// client-side preference and a crawler holds none, so without this parameter
// the English site is unindexable — and a language switch that left the URL
// alone would make the two pages' canonicals point at each other's content.
describe("the landing page's language URL", () => {
  function stubApi() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/session")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              configured: true,
              signed_in: false,
              email: null,
              publish_gate: true,
              notifications: true,
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
  }

  /** Renders the page and reports the router's current URL, so a language
   *  toggle can be checked as navigation rather than as component state. */
  function Url() {
    const location = useLocation();
    return <output data-testid="url">{`${location.pathname}${location.search}`}</output>;
  }

  function renderLanding(entry: string) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <LandingPage />
        <Url />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    localStorage.clear();
    forgetHeldManageTokens();
    document.head.innerHTML = "";
    stubApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders English for ?lang=en even with no stored preference", () => {
    renderLanding("/?lang=en");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "An invitation from one sentence",
    );
    expect(document.documentElement.lang).toBe("en");
  });

  // Otherwise the first click through to the editor silently switches back:
  // /create reads the stored preference and knows nothing about the URL.
  it("adopts the URL's language as this browser's preference", () => {
    renderLanding("/?lang=en");
    expect(localStorage.getItem("inv-ui-lang")).toBe("en");
  });

  it("moves the URL to the language on screen", () => {
    renderLanding("/");
    expect(screen.getByTestId("url").textContent).toBe("/");

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByTestId("url").textContent).toBe("/?lang=en");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${window.location.origin}/?lang=en`,
    );

    fireEvent.click(screen.getByRole("button", { name: "UK" }));
    expect(screen.getByTestId("url").textContent).toBe("/");
  });

  // Every unknown path renders this component (AppRoutes `*`) — a kindness to
  // a person and, without this, a duplicate of the home page to a crawler.
  it("does not let an unknown path claim to be the home page", () => {
    renderLanding("/some-old-link");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, follow",
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
