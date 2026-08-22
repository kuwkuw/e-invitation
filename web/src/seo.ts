import { useEffect } from "react";
import { SEO, type SeoPage } from "./i18n";
import type { Language } from "./types";

// Client-side head management (adr-016 §6).
//
// The server already ships each path's head in the shell it serves
// (`server/src/seo.ts`), which is what a crawler and every messenger unfurler
// actually read — they fetch one URL and never navigate. This module covers
// what that cannot: a **client-side** route change, after which the document
// still carries the head of the page the visitor arrived on. That leaves the
// browser tab lying about where you are, and leaves a rendering crawler
// reading `/`'s canonical on `/create`.
//
// So the rule is narrow: this mirrors the server for the tags that are wrong
// after a navigation — title, description, robots, canonical, `<html lang>`.
// It deliberately does **not** touch `og:*`: no unfurler runs JavaScript, so
// updating those would be work no reader ever sees, and the shell's values are
// already the ones the crawler was handed.

export type Robots = "index, follow" | "noindex, follow" | "noindex, nofollow";

export interface DocumentMeta {
  lang: Language;
  title: string;
  description: string;
  robots: Robots;
  /** Absolute URL, or null on every `noindex` page — the same rule the server
   *  applies, and the reason this must *remove* a stale tag rather than only
   *  overwrite one: arriving on `/` and navigating to `/create` would
   *  otherwise leave `/`'s canonical claiming this page is the home page. */
  canonical: string | null;
}

/** `?lang=` is the English home page's address (adr-016 §5). Anything that is
 *  not one of the two languages reads as absent, so a typo falls back to the
 *  stored preference rather than inventing a third variant. */
export function langFromSearch(search: string): Language | null {
  const value = new URLSearchParams(search).get("lang");
  return value === "en" || value === "uk" ? value : null;
}

/** Head metadata for the three shell routes plus the unknown-path case, in the
 *  language on screen. Mirrors `shellMeta` in `server/src/seo.ts` — the copy
 *  lives in `i18n.ts` the way `types.ts` mirrors `schemas.ts`, and the two
 *  sides are kept in step by hand. */
export function routeMeta(page: SeoPage, lang: Language, search = ""): DocumentMeta {
  const strings = SEO[lang][page];
  if (page === "landing") {
    // Canonical follows the **URL**, not the language on screen: a returning
    // visitor whose stored preference is English still reached `/`, and a page
    // that names a different canonical than the one the server served would
    // make the home page compete with itself.
    const canonical =
      langFromSearch(search) === "en"
        ? `${window.location.origin}/?lang=en`
        : `${window.location.origin}/`;
    return { lang, ...strings, robots: "index, follow", canonical };
  }
  return {
    lang,
    ...strings,
    // The editor is an application, the dashboard is someone's guest list, and
    // an unknown path is a duplicate of the home page. `nofollow` only on the
    // dashboard, whose links are that host's own invitation and manage URLs.
    robots: page === "manage" ? "noindex, nofollow" : "noindex, follow",
    canonical: null,
  };
}

/** Rewrites the tag the server put in the shell, or adds it if this document
 *  never had one — never a second copy beside the first. */
function upsertNamedMeta(name: string, content: string): void {
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/** Write one page's metadata into the live document. Idempotent: it reuses the
 *  tags the server already put in the shell rather than stacking duplicates. */
export function applyDocumentMeta(meta: DocumentMeta): void {
  document.documentElement.lang = meta.lang;
  document.title = meta.title;
  upsertNamedMeta("description", meta.description);
  upsertNamedMeta("robots", meta.robots);

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (meta.canonical === null) {
    canonical?.remove();
    return;
  }
  const link = canonical ?? document.head.appendChild(document.createElement("link"));
  link.setAttribute("rel", "canonical");
  link.setAttribute("href", meta.canonical);
}

/** Applies on mount and on every change to the metadata itself — the fields
 *  are the dependencies, not the object, because callers build a fresh literal
 *  on every render. No cleanup: there is one document and one screen mounted in
 *  it, so the next screen overwrites these rather than inheriting a reset.
 *
 *  `null` leaves the document alone. That is the guest page before its
 *  invitation arrives: the server already rendered the real title into the
 *  shell, and replacing it with "Loading…" for a beat would be a worse tab
 *  than the one the visitor was handed. */
export function useDocumentMeta(meta: DocumentMeta | null): void {
  const {
    lang = null,
    title = null,
    description = null,
    robots = null,
    canonical = null,
  } = meta ?? {};
  useEffect(() => {
    // All four move together — either the caller has metadata or it does not.
    if (lang === null || title === null || description === null || robots === null) return;
    applyDocumentMeta({ lang, title, description, robots, canonical });
  }, [lang, title, description, robots, canonical]);
}
