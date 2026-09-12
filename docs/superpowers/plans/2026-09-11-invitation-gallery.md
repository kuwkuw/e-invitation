# Invitation Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, indexed gallery of ready-to-use invitation texts — `/gallery` plus six occasion pages in two languages — whose examples seed the editor with no model call.

**Architecture:** Gallery content is a typed table in the web bundle (six occasions × four examples × two languages), rendered by two new React screens that reuse `InvitationPreview` unchanged. `server/src/seo.ts` gains the head metadata, canonicals and sitemap entries for the new paths; `prerender.ts` grows from one block per language to one per (path × language) so a crawler sees real HTML. "Use this one" links to `/create?sample=<id>`, which seeds the existing `restored` path in `useInvitationEditor` that adr-014 §2 built for the sign-in draft.

**Tech Stack:** TypeScript, pnpm workspaces, Fastify (server), Vite + React + react-router-dom declarative mode (web), vitest + @testing-library/react under jsdom, Biome.

**Spec:** [docs/decisions/adr-017-invitation-gallery.md](../../decisions/adr-017-invitation-gallery.md)

## Global Constraints

- **Six occasions, English slugs:** `wedding`, `birthday`, `kids`, `christening`, `corporate`, `jubilee`. Mirrored by hand in `server/src/seo.ts` and `web/src/gallery/occasions.ts` (NFR-8); drift means a slug the server indexes and the client 404s.
- **Every example carries `date: null`, `time: null`, `venue: null`, `city: null`.** A hardcoded date eventually trips FR-1.8 and makes the template unpublishable.
- **`/gallery` and `/gallery/<known occasion>` are `index, follow` WITH a canonical.** Unknown occasion → `notFound` strings + `noindex` on the server AND a not-found render on the client. Every other surface keeps the robots value it has today.
- **`robots.txt` must not change.** It still must not disallow `/i/`, and must keep `Allow: /api/invitations/*/og.png` above `Disallow: /api/`.
- **English is `?lang=en`, never a separate path** (FR-13.6).
- **Copy fields are exactly six:** `title`, `greeting`, `body`, `details_line`, `rsvp_prompt`, `closing`.
- **Never `history.replaceState`** — URL rewriting goes through `navigate(…, { replace: true })` (adr-011 §4).
- **`vite.config.ts` sets `globals: false`**, so RTL never auto-cleans: every component test must `afterEach(cleanup)`.
- **Bundle budget:** NFR-1 records 88.9 kB gzipped. Measure at the end; past ~100 kB, adr-017 §5's revisit trigger fires.
- Commands run from the repo root. Web tests: `pnpm --filter inv-app-web exec vitest run <file>`. Server tests: `pnpm --filter inv-app-server exec vitest run <file>`. Single test: add `-t "name"`.

## File Structure

**Created:**
- `web/src/gallery/occasions.ts` — the occasion id list, its type, and `isOccasionId`. No content, so the server mirror is a six-line diff.
- `web/src/gallery/types.ts` — `GalleryExample`, `GallerySample`.
- `web/src/gallery/designs.ts` — `GALLERY_DESIGNS`, one `DesignTokens` per example id, shared across languages.
- `web/src/gallery/content.uk.ts`, `web/src/gallery/content.en.ts` — the per-language tables. Split by language, not by occasion, so the parity test compares two whole objects.
- `web/src/gallery/index.ts` — `galleryFor`, `findSample`. The only module the screens import.
- `web/src/GalleryHubPage.tsx`, `web/src/GalleryOccasionPage.tsx` — beside `LandingPage.tsx`, matching how screens live today.
- `web/src/components/gallery/ExampleCard.tsx` — the repeated unit: card, style label, CTA.
- `web/src/hooks/useGallerySample.ts` — reads and strips `?sample=`.
- Tests: `web/test/gallery.test.ts`, `web/test/GalleryOccasionPage.test.tsx`, `web/test/useGallerySample.test.ts`.

**Modified:**
- `server/src/seo.ts` — occasion mirror, `GALLERY_SEO`, `shellMeta` branches, `alternatesFor`, `sitemapXml`, `prerenderKey`, `selectPrerender`.
- `web/src/prerender.ts` — `prerenderMarkers` keyed by page, `galleryBodyHtml`, `prerenderBlocks`.
- `web/src/AppRoutes.tsx` — two routes.
- `web/src/hooks/useInvitationEditor.ts` — lift the date check; seed `description`.
- `web/src/App.tsx` — wire the sample.
- `web/src/styles.css` — `.gl-*` block.
- `web/src/i18n.ts`, `web/src/types.ts`, `server/src/schemas.ts` — `GenerateSource` gains `gallery`; gallery UI strings.
- `server/src/metrics.ts`, `server/src/routes/*` — attribution counters.
- `web/test/i18n.test.ts` — parity walk extended over the gallery tables.

---

### Task 1: Occasion ids, mirrored on both sides

**Files:**
- Create: `web/src/gallery/occasions.ts`
- Modify: `server/src/seo.ts` (add near `SEO_STRINGS`)
- Test: `web/test/gallery.test.ts`, `server/test/seo.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `OCCASION_IDS: readonly OccasionId[]`, `type OccasionId`, `isOccasionId(value: string): value is OccasionId` (web). `GALLERY_OCCASIONS: readonly GalleryOccasion[]`, `type GalleryOccasion`, `isGalleryOccasion(value: string): value is GalleryOccasion` (server).

- [ ] **Step 1: Write the failing test**

`web/test/gallery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isOccasionId, OCCASION_IDS } from "../src/gallery/occasions";

describe("occasion ids", () => {
  it("lists the six occasions in a stable order", () => {
    expect([...OCCASION_IDS]).toEqual([
      "wedding",
      "birthday",
      "kids",
      "christening",
      "corporate",
      "jubilee",
    ]);
  });

  it("accepts a known occasion and rejects anything else", () => {
    expect(isOccasionId("wedding")).toBe(true);
    expect(isOccasionId("Wedding")).toBe(false);
    expect(isOccasionId("../etc")).toBe(false);
    expect(isOccasionId("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/gallery.test.ts`
Expected: FAIL — cannot resolve `../src/gallery/occasions`.

- [ ] **Step 3: Write minimal implementation**

`web/src/gallery/occasions.ts`:

```ts
// The six occasions the gallery covers (adr-017 §1).
//
// Mirrored by hand in `server/src/seo.ts` as `GALLERY_OCCASIONS`, the way
// `types.ts` mirrors `schemas.ts` (NFR-8) — the workspaces cannot import
// across. This mirror matters more than a type mirror: a slug present on one
// side and not the other is a URL the server offers for indexing and the
// client answers with a dead link. Change both in one pass.
export const OCCASION_IDS = [
  "wedding",
  "birthday",
  "kids",
  "christening",
  "corporate",
  "jubilee",
] as const;

export type OccasionId = (typeof OCCASION_IDS)[number];

/** The router's `:occasion` param matches any non-empty segment, so this is
 *  the guard — the same job `isInvitationId` does for `:id` (adr-011 §3). */
export function isOccasionId(value: string): value is OccasionId {
  return (OCCASION_IDS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/gallery.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the server mirror and its test**

In `server/src/seo.ts`, immediately after the `ShellPage` type declaration, add:

```ts
/** The gallery's occasions (adr-017 §1). **Mirrored by hand** in
 *  `web/src/gallery/occasions.ts` — keep the two lists identical and in the
 *  same order. A slug here that is missing there is a page this server marks
 *  `index, follow` and the client renders as a dead link. */
export const GALLERY_OCCASIONS = [
  "wedding",
  "birthday",
  "kids",
  "christening",
  "corporate",
  "jubilee",
] as const;

export type GalleryOccasion = (typeof GALLERY_OCCASIONS)[number];

export function isGalleryOccasion(value: string): value is GalleryOccasion {
  return (GALLERY_OCCASIONS as readonly string[]).includes(value);
}
```

Append to `server/test/seo.test.ts`:

```ts
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
```

Add `GALLERY_OCCASIONS` and `isGalleryOccasion` to that file's existing import from `../src/seo.js`.

- [ ] **Step 6: Run both suites**

Run: `pnpm --filter inv-app-web exec vitest run test/gallery.test.ts`
Run: `pnpm --filter inv-app-server exec vitest run test/seo.test.ts`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add web/src/gallery/occasions.ts web/test/gallery.test.ts server/src/seo.ts server/test/seo.test.ts
git commit -m "Add the gallery's six occasion ids, mirrored on both sides (adr-017 §1)"
```

---

### Task 2: The content shape, and the wedding occasion in both languages

**Files:**
- Create: `web/src/gallery/types.ts`, `web/src/gallery/designs.ts`, `web/src/gallery/content.uk.ts`, `web/src/gallery/content.en.ts`, `web/src/gallery/index.ts`
- Test: `web/test/gallery.test.ts` (extend)

**Interfaces:**
- Consumes: `OccasionId` from Task 1; `EventBrief`, `InvitationCopy`, `DesignTokens`, `Language`, `Invitation` from `web/src/types.ts`.
- Produces: `GalleryExample`, `GallerySample`, `GALLERY_DESIGNS: Record<string, DesignTokens>`, `galleryFor(occasion: OccasionId, lang: Language): GalleryExample[]`, `findSample(sampleId: string, lang: Language): GallerySample | null`, `sampleInvitation(sample: GallerySample): Invitation`.

- [ ] **Step 1: Write the failing test**

Append to `web/test/gallery.test.ts`:

```ts
import { findSample, galleryFor, sampleInvitation } from "../src/gallery";

describe("gallery content", () => {
  it("gives four wedding examples in both languages", () => {
    expect(galleryFor("wedding", "uk")).toHaveLength(4);
    expect(galleryFor("wedding", "en")).toHaveLength(4);
  });

  it("carries no date, time, venue or city on any example", () => {
    for (const lang of ["uk", "en"] as const) {
      for (const example of galleryFor("wedding", lang)) {
        expect(example.brief.date).toBeNull();
        expect(example.brief.time).toBeNull();
        expect(example.brief.venue).toBeNull();
        expect(example.brief.city).toBeNull();
      }
    }
  });

  it("states the brief's language to match the table it is in", () => {
    expect(galleryFor("wedding", "en")[0].brief.language).toBe("en");
    expect(galleryFor("wedding", "uk")[0].brief.language).toBe("uk");
  });

  it("resolves a sample id to a full invitation", () => {
    const sample = findSample("wedding-romantic", "uk");
    expect(sample).not.toBeNull();
    expect(sample?.occasion).toBe("wedding");
    const invitation = sampleInvitation(sample!);
    expect(invitation.copy.title).toBe("Ми одружуємось!");
    expect(invitation.design.palette).toBe("romantic");
    expect(invitation.background).toBeNull();
  });

  it("returns null for an unknown sample id", () => {
    expect(findSample("wedding-nope", "uk")).toBeNull();
    expect(findSample("", "uk")).toBeNull();
  });

  it("carries the sentence that produced each example", () => {
    for (const example of galleryFor("wedding", "uk")) {
      expect(example.sentence.length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/gallery.test.ts`
Expected: FAIL — cannot resolve `../src/gallery`.

- [ ] **Step 3: Write the types**

`web/src/gallery/types.ts`:

```ts
import type { DesignTokens, EventBrief, InvitationCopy } from "../types";
import type { OccasionId } from "./occasions";

/** One ready-to-use invitation on a gallery page (adr-017 §3).
 *
 *  A full invitation, not a card: the editor regenerates fields from
 *  `invitation.brief`, so an example without one breaks on the first "rewrite
 *  this line". Design tokens are NOT here — they are shared across languages
 *  and live in `designs.ts`, joined by `id`, the same split `LandingPage.tsx`
 *  makes for its hero samples. */
export interface GalleryExample {
  /** Globally unique, URL-safe, stable — this is the `?sample=` value. */
  id: string;
  /** Style name shown under the card ("Романтичний"). */
  style: string;
  /** One line under the style name. */
  styleNote: string;
  /** The sentence this example was generated from. Seeds the editor's
   *  `description` so the host's next chat turn builds on this event rather
   *  than replacing it with an unrelated one (adr-017 §4). */
  sentence: string;
  brief: EventBrief;
  copy: InvitationCopy;
}

/** An example resolved against its design tokens and occasion. */
export interface GallerySample {
  occasion: OccasionId;
  example: GalleryExample;
  design: DesignTokens;
}
```

- [ ] **Step 4: Write the designs table**

`web/src/gallery/designs.ts`:

```ts
import type { DesignTokens } from "../types";

/** Design tokens per example id, shared by both languages (adr-017 §2).
 *
 *  Tokens are presentation, not words: translating them would mean two ways to
 *  say "romantic script". The four examples of an occasion must differ from
 *  each other — four `warm`/`serif`/`classic` cards tell a visitor the product
 *  has one look, and `gallery.test.ts` holds that as a rule. */
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
```

- [ ] **Step 5: Write the Ukrainian content**

`web/src/gallery/content.uk.ts`:

```ts
import type { OccasionId } from "./occasions";
import type { GalleryExample } from "./types";

/** A brief with nothing but words: the gallery's examples state no date, time,
 *  venue or city (adr-017 §3), so this is the whole of the shared shape. */
function brief(event_type: string, hosts: string[], tone: string) {
  return {
    event_type,
    hosts,
    date: null,
    time: null,
    venue: null,
    city: null,
    tone,
    language: "uk" as const,
    extra_details: null,
  };
}

export const GALLERY_UK: Partial<Record<OccasionId, GalleryExample[]>> = {
  wedding: [
    {
      id: "wedding-romantic",
      style: "Романтичний",
      styleNote: "Рукописний шрифт, тепла пастель",
      sentence: "Ми з Андрієм одружуємось і запрошуємо рідних та друзів",
      brief: brief("весілля", ["Олена", "Андрій"], "романтичний"),
      copy: {
        title: "Ми одружуємось!",
        greeting: "Любі рідні та друзі,",
        body: "З радістю запрошуємо вас розділити з нами день, коли ми скажемо одне одному «так».",
        details_line: "Дату та місце повідомимо особисто",
        rsvp_prompt: "Дайте знати, чи зможете бути поруч.",
        closing: "Олена та Андрій",
      },
    },
    {
      id: "wedding-formal",
      style: "Стриманий",
      styleNote: "Заголовок-банер, офіційний тон",
      sentence: "Весілля Олени та Андрія, офіційне запрошення для гостей",
      brief: brief("весілля", ["Олена", "Андрій"], "офіційний"),
      copy: {
        title: "Олена та Андрій запрошують",
        greeting: "Шановні гості,",
        body: "Ми будемо щиро раді бачити вас серед найближчих людей у день нашого весілля.",
        details_line: "Деталі урочистості надішлемо згодом",
        rsvp_prompt: "Просимо підтвердити свою присутність.",
        closing: "Родини Коваль і Мельник",
      },
    },
    {
      id: "wedding-festive",
      style: "Урочистий",
      styleNote: "Текст ліворуч, насичений акцент",
      sentence: "Велике весілля з музикою і танцями, запрошуємо всіх друзів",
      brief: brief("весілля", ["Олена", "Андрій"], "святковий"),
      copy: {
        title: "Весілля Олени та Андрія",
        greeting: "Дорогі друзі!",
        body: "Збираємо всіх, кого любимо, на свято, якого ми довго чекали. Буде музика, танці та дуже багато радості.",
        details_line: "Дата й місце — зовсім скоро",
        rsvp_prompt: "Напишіть, чи святкуєте разом із нами.",
        closing: "До зустрічі!",
      },
    },
    {
      id: "wedding-minimal",
      style: "Мінімалістичний",
      styleNote: "Без прикрас, коротко й сучасно",
      sentence: "Коротке сучасне запрошення на весілля без зайвих слів",
      brief: brief("весілля", ["Олена", "Андрій"], "сучасний"),
      copy: {
        title: "Незабаром — наше весілля",
        greeting: "Привіт!",
        body: "Ми одружуємось і дуже хочемо, щоб ви були поруч. Деталі — трохи згодом.",
        details_line: "Дату оголосимо найближчим часом",
        rsvp_prompt: "Відповідайте, щойно будете готові.",
        closing: "Олена + Андрій",
      },
    },
  ],
};
```

- [ ] **Step 6: Write the English content**

`web/src/gallery/content.en.ts`, same shape with `language: "en"`:

```ts
import type { OccasionId } from "./occasions";
import type { GalleryExample } from "./types";

function brief(event_type: string, hosts: string[], tone: string) {
  return {
    event_type,
    hosts,
    date: null,
    time: null,
    venue: null,
    city: null,
    tone,
    language: "en" as const,
    extra_details: null,
  };
}

export const GALLERY_EN: Partial<Record<OccasionId, GalleryExample[]>> = {
  wedding: [
    {
      id: "wedding-romantic",
      style: "Romantic",
      styleNote: "Handwritten display, warm pastels",
      sentence: "Olena and Andrii are getting married and inviting family and friends",
      brief: brief("wedding", ["Olena", "Andrii"], "romantic"),
      copy: {
        title: "We're getting married!",
        greeting: "Dear family and friends,",
        body: "We would love you to be with us on the day we say yes to each other.",
        details_line: "We'll share the date and place personally",
        rsvp_prompt: "Let us know if you can be there.",
        closing: "Olena & Andrii",
      },
    },
    {
      id: "wedding-formal",
      style: "Formal",
      styleNote: "Banner heading, classic wording",
      sentence: "A formal wedding invitation from Olena and Andrii to their guests",
      brief: brief("wedding", ["Olena", "Andrii"], "formal"),
      copy: {
        title: "Olena and Andrii invite you",
        greeting: "Dear guests,",
        body: "We would be honoured to have you among the people closest to us on our wedding day.",
        details_line: "Details of the ceremony will follow",
        rsvp_prompt: "Kindly confirm your attendance.",
        closing: "The Koval and Melnyk families",
      },
    },
    {
      id: "wedding-festive",
      style: "Festive",
      styleNote: "Left-aligned text, deep accent",
      sentence: "A big wedding party with music and dancing, inviting all our friends",
      brief: brief("wedding", ["Olena", "Andrii"], "festive"),
      copy: {
        title: "Olena and Andrii's wedding",
        greeting: "Dear friends!",
        body: "We're gathering everyone we love for a celebration we've waited a long time for. There will be music, dancing and a great deal of joy.",
        details_line: "The date and place are coming very soon",
        rsvp_prompt: "Tell us if you're celebrating with us.",
        closing: "See you there!",
      },
    },
    {
      id: "wedding-minimal",
      style: "Minimal",
      styleNote: "No ornament, short and modern",
      sentence: "A short modern wedding invitation with no extra words",
      brief: brief("wedding", ["Olena", "Andrii"], "modern"),
      copy: {
        title: "Our wedding is coming",
        greeting: "Hello!",
        body: "We're getting married and we really want you there. Details to follow shortly.",
        details_line: "We'll announce the date soon",
        rsvp_prompt: "Reply whenever you're ready.",
        closing: "Olena + Andrii",
      },
    },
  ],
};
```

- [ ] **Step 7: Write the accessor module**

`web/src/gallery/index.ts`:

```ts
import type { Invitation, Language } from "../types";
import { GALLERY_EN } from "./content.en";
import { GALLERY_UK } from "./content.uk";
import { GALLERY_DESIGNS } from "./designs";
import { isOccasionId, OCCASION_IDS, type OccasionId } from "./occasions";
import type { GalleryExample, GallerySample } from "./types";

export { GALLERY_DESIGNS } from "./designs";
export { isOccasionId, OCCASION_IDS, type OccasionId } from "./occasions";
export type { GalleryExample, GallerySample } from "./types";

const TABLES = { uk: GALLERY_UK, en: GALLERY_EN };

export function galleryFor(occasion: OccasionId, lang: Language): GalleryExample[] {
  return TABLES[lang][occasion] ?? [];
}

/** Resolve a `?sample=` value. Null for anything unknown — the parameter is a
 *  hint from a link, not a credential, and an unrecognised one means the
 *  editor simply opens empty. */
export function findSample(sampleId: string, lang: Language): GallerySample | null {
  if (!sampleId) return null;
  for (const occasion of OCCASION_IDS) {
    const example = galleryFor(occasion, lang).find((e) => e.id === sampleId);
    const design = GALLERY_DESIGNS[sampleId];
    if (example && design) return { occasion, example, design };
  }
  return null;
}

/** The sample as the editor's own type. `background` is explicitly null: the
 *  AI background layer is an editor action (adr-009), never part of a sample. */
export function sampleInvitation(sample: GallerySample): Invitation {
  return {
    brief: sample.example.brief,
    copy: sample.example.copy,
    design: sample.design,
    background: null,
  };
}

/** Occasions that actually have content, in `OCCASION_IDS` order. Lets the hub
 *  ship before all six are written without listing a tile that leads nowhere. */
export function populatedOccasions(lang: Language): OccasionId[] {
  return OCCASION_IDS.filter((o) => galleryFor(o, lang).length > 0);
}
```

Note the import list above pulls `isOccasionId` and `OCCASION_IDS` in for local use *and* re-exports them on the line below; that is deliberate so the screens import everything from `./gallery` and never reach into its files.

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/gallery.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 9: Typecheck and lint**

Run: `pnpm --filter inv-app-web exec tsc --noEmit`
Run: `pnpm lint`
Expected: both clean.

- [ ] **Step 10: Commit**

```bash
git add web/src/gallery web/test/gallery.test.ts
git commit -m "Add the gallery content model and the wedding occasion (adr-017 §2, §3)"
```

---

### Task 3: Head metadata, canonicals and the sitemap

**Files:**
- Modify: `server/src/seo.ts`
- Test: `server/test/seo.test.ts`

**Interfaces:**
- Consumes: `GALLERY_OCCASIONS`, `isGalleryOccasion` from Task 1.
- Produces: `GALLERY_SEO: Record<Language, Record<GalleryOccasion, PageStrings>>`, `alternatesFor(base: string, path: string): { hreflang: string; href: string }[]`. `ShellPage` gains `"gallery"`.

- [ ] **Step 1: Write the failing test**

Append to `server/test/seo.test.ts`:

```ts
describe("gallery head metadata", () => {
  it("offers the hub for indexing with a canonical", () => {
    const meta = shellMeta("/gallery", "", DEFAULT_ORIGIN);
    expect(meta.robots).toBe("index, follow");
    expect(meta.canonical).toBe(`${DEFAULT_ORIGIN}/gallery`);
    expect(meta.alternates).toEqual([
      { hreflang: "uk", href: `${DEFAULT_ORIGIN}/gallery` },
      { hreflang: "en", href: `${DEFAULT_ORIGIN}/gallery?lang=en` },
      { hreflang: "x-default", href: `${DEFAULT_ORIGIN}/gallery` },
    ]);
  });

  it("offers a known occasion for indexing, in the requested language", () => {
    const meta = shellMeta("/gallery/wedding", "lang=en", DEFAULT_ORIGIN);
    expect(meta.robots).toBe("index, follow");
    expect(meta.canonical).toBe(`${DEFAULT_ORIGIN}/gallery/wedding?lang=en`);
    expect(meta.lang).toBe("en");
    expect(meta.title).toContain("wedding");
  });

  it("refuses an unknown occasion", () => {
    const meta = shellMeta("/gallery/nope", "", DEFAULT_ORIGIN);
    expect(meta.robots).toBe("noindex, follow");
    expect(meta.canonical).toBeNull();
  });

  it("never offers a canonical on a noindex page", () => {
    for (const path of ["/create", "/manage/abc", "/gallery/nope", "/whatever"]) {
      const meta = shellMeta(path, "", DEFAULT_ORIGIN);
      if (meta.robots.startsWith("noindex")) expect(meta.canonical).toBeNull();
    }
  });
});

describe("sitemap with the gallery", () => {
  const xml = sitemapXml(DEFAULT_ORIGIN);

  it("lists fourteen urls", () => {
    expect(xml.match(/<loc>/g)).toHaveLength(14);
  });

  it("lists every occasion in both languages", () => {
    for (const occasion of GALLERY_OCCASIONS) {
      expect(xml).toContain(`<loc>${DEFAULT_ORIGIN}/gallery/${occasion}</loc>`);
      expect(xml).toContain(`<loc>${DEFAULT_ORIGIN}/gallery/${occasion}?lang=en</loc>`);
    }
  });

  it("gives every url a complete hreflang set", () => {
    const urls = xml.split("<url>").slice(1);
    expect(urls).toHaveLength(14);
    for (const url of urls) {
      expect(url.match(/hreflang=/g)).toHaveLength(3);
    }
  });
});

describe("robots.txt is unchanged by the gallery", () => {
  const txt = robotsTxt(DEFAULT_ORIGIN);

  it("still allows the og image before disallowing /api/", () => {
    expect(txt.indexOf("Allow: /api/invitations/*/og.png")).toBeLessThan(
      txt.indexOf("Disallow: /api/"),
    );
  });

  it("still does not disallow /i/ or /gallery", () => {
    expect(txt).not.toContain("Disallow: /i/");
    expect(txt).not.toContain("Disallow: /gallery");
  });
});
```

Add `sitemapXml`, `robotsTxt`, `GALLERY_OCCASIONS` to the file's imports if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-server exec vitest run test/seo.test.ts`
Expected: FAIL — `/gallery` currently falls through to `notFound`, and the sitemap has 2 urls.

- [ ] **Step 3: Add the gallery search copy**

In `server/src/seo.ts`, widen `ShellPage` and add the occasion table:

```ts
export type ShellPage = "landing" | "create" | "manage" | "notFound" | "gallery";
```

Add `gallery` to both language blocks of `SEO_STRINGS`:

```ts
// inside SEO_STRINGS.uk
    gallery: {
      title: `Зразки запрошень — готові тексти · ${SITE_NAME}`,
      description:
        "Готові тексти запрошень на весілля, день народження, хрестини, корпоратив і ювілей — " +
        "візьміть будь-який, змініть під себе й надішліть гостям посилання.",
    },
// inside SEO_STRINGS.en
    gallery: {
      title: `Invitation templates — ready-made wording · ${SITE_NAME}`,
      description:
        "Ready-made invitation wording for weddings, birthdays, christenings and office parties — " +
        "take one, make it yours, and send your guests a link.",
    },
```

Then, after `SEO_STRINGS`, add:

```ts
/** Search copy per occasion page. Separate from `SEO_STRINGS` because these
 *  are keyed by occasion rather than by `ShellPage`, and bolting six
 *  pseudo-pages onto that union would make the type lie about what a shell
 *  page is. Written for a result listing: the occasion word leads, because
 *  that is the word that was searched. */
export const GALLERY_SEO: Record<Language, Record<GalleryOccasion, PageStrings>> = {
  uk: {
    wedding: {
      title: `Запрошення на весілля: готові тексти · ${SITE_NAME}`,
      description:
        "Чотири готові тексти весільного запрошення — романтичний, стриманий, урочистий і " +
        "мінімалістичний. Візьміть будь-який, змініть слова й надішліть гостям посилання.",
    },
    birthday: {
      title: `Запрошення на день народження: готові тексти · ${SITE_NAME}`,
      description:
        "Готові тексти запрошення на день народження — від теплого до сучасного. " +
        "Оберіть, допишіть дату й місце, і збирайте відповіді гостей.",
    },
    kids: {
      title: `Запрошення на дитяче свято: готові тексти · ${SITE_NAME}`,
      description:
        "Готові тексти запрошення на дитячий день народження та свято — " +
        "яскраві й прості. Візьміть зразок і змініть під свою подію.",
    },
    christening: {
      title: `Запрошення на хрестини: готові тексти · ${SITE_NAME}`,
      description:
        "Готові тексти запрошення на хрестини — стримані й теплі. " +
        "Оберіть зразок, допишіть деталі й надішліть рідним посилання.",
    },
    corporate: {
      title: `Запрошення на корпоратив: готові тексти · ${SITE_NAME}`,
      description:
        "Готові тексти запрошення на корпоратив і новорічну вечірку компанії. " +
        "Візьміть зразок, змініть під себе й зберіть відповіді колег.",
    },
    jubilee: {
      title: `Запрошення на ювілей: готові тексти · ${SITE_NAME}`,
      description:
        "Готові тексти запрошення на ювілей — урочисті й теплі. " +
        "Оберіть зразок, допишіть дату й місце, і надішліть гостям посилання.",
    },
  },
  en: {
    wedding: {
      title: `Wedding invitation wording: ready-made texts · ${SITE_NAME}`,
      description:
        "Four ready-made wedding invitation texts — romantic, formal, festive and minimal. " +
        "Take one, change the words, and send your guests a link.",
    },
    birthday: {
      title: `Birthday invitation wording: ready-made texts · ${SITE_NAME}`,
      description:
        "Ready-made birthday invitation wording, from warm to modern. " +
        "Pick one, add your date and place, and collect replies.",
    },
    kids: {
      title: `Kids party invitation wording: ready-made texts · ${SITE_NAME}`,
      description:
        "Ready-made wording for a children's birthday or party invitation — " +
        "bright and simple. Take a sample and make it yours.",
    },
    christening: {
      title: `Christening invitation wording: ready-made texts · ${SITE_NAME}`,
      description:
        "Ready-made christening invitation wording, quiet and warm. " +
        "Pick a sample, add the details, and send your family a link.",
    },
    corporate: {
      title: `Office party invitation wording: ready-made texts · ${SITE_NAME}`,
      description:
        "Ready-made wording for a company party or end-of-year event invitation. " +
        "Take a sample, make it yours, and collect your colleagues' replies.",
    },
    jubilee: {
      title: `Anniversary invitation wording: ready-made texts · ${SITE_NAME}`,
      description:
        "Ready-made anniversary invitation wording, formal and warm. " +
        "Pick a sample, add your date and place, and send your guests a link.",
    },
  },
};
```

- [ ] **Step 4: Generalize the alternates helper**

Replace `landingAlternates` with a path-aware version, keeping the old name as a thin caller so existing tests and `landingJsonLd` keep working:

```ts
/** Every URL in an hreflang set repeats the whole set — a sitemap that names
 *  the alternates only on one of them describes a one-way relationship, which
 *  Google discards. `path` is the Ukrainian (unsuffixed) address; the English
 *  one is the same path with `?lang=en` (FR-13.6). */
export function alternatesFor(base: string, path: string): { hreflang: string; href: string }[] {
  const uk = `${base}${path}`;
  return [
    { hreflang: "uk", href: uk },
    { hreflang: "en", href: `${uk}?lang=en` },
    { hreflang: "x-default", href: uk },
  ];
}

export function landingAlternates(base: string): { hreflang: string; href: string }[] {
  return alternatesFor(base, "/");
}
```

- [ ] **Step 5: Add the shellMeta branches**

In `shellMeta`, immediately after the `/` branch and before the `/create` branch:

```ts
  // The gallery (adr-017 §1). The first pages after the landing page offered
  // for indexing, and the first canonicals in the product — FR-13.2 named the
  // landing page as the only indexed page, and this amends it.
  if (path === "/gallery" || path.startsWith("/gallery/")) {
    const slug = path === "/gallery" ? "" : path.slice("/gallery/".length);
    // An unknown occasion falls through to `notFound` below rather than being
    // indexed: the client renders a dead link for it, and a URL we mark
    // `index, follow` must not be one the app refuses to draw.
    if (slug === "" || isGalleryOccasion(slug)) {
      const canonicalPath = slug === "" ? "/gallery" : `/gallery/${slug}`;
      const canonical =
        lang === "en" ? `${base}${canonicalPath}?lang=en` : `${base}${canonicalPath}`;
      const strings = slug === "" ? SEO_STRINGS[lang].gallery : GALLERY_SEO[lang][slug];
      return {
        ...common,
        ...strings,
        robots: "index, follow",
        canonical,
        url: canonical,
        alternates: alternatesFor(base, canonicalPath),
      };
    }
  }
```

- [ ] **Step 6: Grow the sitemap**

Replace `sitemapXml`'s body:

```ts
export function sitemapXml(base: string): string {
  const entry = (path: string, priority: string) => {
    const alternates = alternatesFor(base, path)
      .map(
        (a) =>
          `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeHtml(a.href)}"/>`,
      )
      .join("\n");
    return (loc: string) =>
      [
        "  <url>",
        `    <loc>${escapeHtml(loc)}</loc>`,
        alternates,
        "    <changefreq>weekly</changefreq>",
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
  };

  const pages: { path: string; priority: string }[] = [
    { path: "/", priority: "1.0" },
    { path: "/gallery", priority: "0.9" },
    ...GALLERY_OCCASIONS.map((o) => ({ path: `/gallery/${o}`, priority: "0.8" })),
  ];

  const rows = pages.flatMap((page) => {
    const render = entry(page.path, page.priority);
    return [render(`${base}${page.path}`), render(`${base}${page.path}?lang=en`)];
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...rows,
    "</urlset>",
    "",
  ].join("\n");
}
```

The final function contains exactly four things: `entry`, `pages`, `rows` and the return.

- [ ] **Step 7: Run the suite**

Run: `pnpm --filter inv-app-server exec vitest run test/seo.test.ts`
Expected: PASS, including the pre-existing committed-shell test — `shellMeta("/", "", DEFAULT_ORIGIN)` must be byte-identical to before.

- [ ] **Step 8: Commit**

```bash
git add server/src/seo.ts server/test/seo.test.ts
git commit -m "Offer the gallery for indexing, with canonicals and a sitemap (adr-017 §1)"
```

---

### Task 4: Prerender per (path × language)

**Files:**
- Modify: `web/src/prerender.ts`, `web/vite.config.ts`, `server/src/seo.ts`
- Test: `server/test/seo.test.ts`, `web/test/prerender.test.ts` (create if absent)

**Interfaces:**
- Consumes: `galleryFor`, `populatedOccasions` (Task 2); `GALLERY_SEO`, `GALLERY_OCCASIONS` (Tasks 1, 3).
- Produces: `prerenderMarkers(key: string)`, `prerenderBlocks(): string`, `galleryHubBodyHtml(lang)`, `galleryOccasionBodyHtml(occasion, lang)` (web); `prerenderKey(path: string, lang: Language): string | null`, `selectPrerender(html: string, key: string | null): string` (server).

- [ ] **Step 1: Write the failing server test**

Append to `server/test/seo.test.ts`:

```ts
describe("prerender key", () => {
  it("keys the landing page by language", () => {
    expect(prerenderKey("/", "uk")).toBe("landing:uk");
    expect(prerenderKey("/", "en")).toBe("landing:en");
  });

  it("keys the gallery hub and each occasion", () => {
    expect(prerenderKey("/gallery", "uk")).toBe("gallery:uk");
    expect(prerenderKey("/gallery/wedding", "en")).toBe("gallery-wedding:en");
  });

  it("has none for an unknown occasion or any private page", () => {
    expect(prerenderKey("/gallery/nope", "uk")).toBeNull();
    expect(prerenderKey("/create", "uk")).toBeNull();
    expect(prerenderKey("/i/abc", "uk")).toBeNull();
  });
});

describe("selectPrerender", () => {
  const shell =
    "<div id=root>" +
    "<!--pre:landing:uk-->UK LANDING<!--/pre:landing:uk-->" +
    "<!--pre:landing:en-->EN LANDING<!--/pre:landing:en-->" +
    "<!--pre:gallery-wedding:uk-->UK WEDDING<!--/pre:gallery-wedding:uk-->" +
    "</div>";

  it("keeps the requested block and strips every other", () => {
    const out = selectPrerender(shell, "gallery-wedding:uk");
    expect(out).toContain("UK WEDDING");
    expect(out).not.toContain("UK LANDING");
    expect(out).not.toContain("EN LANDING");
  });

  it("strips everything when there is no key", () => {
    const out = selectPrerender(shell, null);
    expect(out).not.toContain("LANDING");
    expect(out).not.toContain("WEDDING");
    expect(out).toContain("<div id=root></div>");
  });

  it("leaves a shell built without the plugin untouched", () => {
    expect(selectPrerender("<div id=root></div>", "landing:uk")).toBe("<div id=root></div>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter inv-app-server exec vitest run test/seo.test.ts`
Expected: FAIL — `prerenderKey` is not exported and `selectPrerender` takes a `Language`.

- [ ] **Step 3: Replace the server side**

In `server/src/seo.ts`, replace `prerenderLanguage` and `selectPrerender`:

```ts
/** Which prerendered block this path should ship, if any (adr-017 §6).
 *
 *  Keyed by page **and** language, because more than one page is now
 *  prerendered. `null` means strip everything: every private page, and any
 *  occasion we do not recognise. */
export function prerenderKey(path: string, lang: Language): string | null {
  if (path === "/") return `landing:${lang}`;
  if (path === "/gallery") return `gallery:${lang}`;
  if (path.startsWith("/gallery/")) {
    const slug = path.slice("/gallery/".length);
    return isGalleryOccasion(slug) ? `gallery-${slug}:${lang}` : null;
  }
  return null;
}

/** Keep one prerendered block, drop the rest.
 *
 *  The shell carries one block per (page × language) (adr-016 §10, adr-017 §6)
 *  and exactly one is right for any request. The others are worse than
 *  nothing: a guest opening a share link would watch a marketing hero sit
 *  there until React replaced it with their invitation.
 *
 *  A shell built without the Vite plugin has no markers and comes back
 *  untouched. */
export function selectPrerender(html: string, key: string | null): string {
  let out = html;
  const blocks = [...html.matchAll(/<!--pre:([a-z0-9:-]+)-->/g)].map((m) => m[1]);
  for (const candidate of blocks) {
    if (candidate === key) continue;
    const open = `<!--pre:${candidate}-->`;
    const close = `<!--/pre:${candidate}-->`;
    const start = out.indexOf(open);
    const end = out.indexOf(close);
    if (start === -1 || end === -1) continue;
    out = out.slice(0, start) + out.slice(end + close.length);
  }
  return out;
}
```

Update `renderShell`'s third parameter from `Language | null` to `string | null`, and both call sites (`app.ts` SPA fallback, `routes/og.ts`) from `prerenderLanguage(path, lang)` to `prerenderKey(path, lang)`. `routes/og.ts` passes nothing for a guest page and stays as it is.

Update the import in `app.ts` from `prerenderLanguage` to `prerenderKey`.

- [ ] **Step 4: Run server tests**

Run: `pnpm --filter inv-app-server exec vitest run test/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing web test**

`web/test/prerender.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prerenderBlocks, prerenderMarkers } from "../src/prerender";

describe("prerender blocks", () => {
  const html = prerenderBlocks();

  it("emits one block per page per language", () => {
    // 1 landing + 1 hub + 6 occasions, twice.
    expect(html.match(/<!--pre:[a-z0-9-]+:(uk|en)-->/g)).toHaveLength(14);
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

  it("links each hub tile with a crawlable href", () => {
    expect(html).toContain('href="/gallery/wedding"');
  });

  it("gives every example a crawlable use-this link", () => {
    expect(html).toContain('href="/create?sample=wedding-romantic"');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/prerender.test.ts`
Expected: FAIL — `prerenderBlocks` is not exported.

- [ ] **Step 7: Extend the web prerender module**

In `web/src/prerender.ts`, replace `prerenderMarkers` and add the gallery bodies:

```ts
/** Blocks are keyed `<page>:<lang>` (adr-017 §6) — `landing:uk`,
 *  `gallery:en`, `gallery-wedding:uk`. `server/src/seo.ts` builds the same
 *  strings in `prerenderKey`; the two are mirrored by hand. */
export const prerenderMarkers = (key: string) => ({
  open: `<!--pre:${key}-->`,
  close: `<!--/pre:${key}-->`,
});
```

Add, after `landingBodyHtml`:

```ts
/** One example, as the crawler sees it. The invitation's text is real markup,
 *  not an image — a gallery of pictures is an empty page for search (adr-017
 *  §2). The class names match `ExampleCard.tsx` so React's swap is invisible. */
function exampleHtml(example: GalleryExample, design: DesignTokens): string {
  // Class names and element types copied from `InvitationPreview.tsx:18-47` —
  // the prerendered block has to say the same things in the same classes, or
  // React's swap on mount is visible. The ornament is an empty div the CSS
  // draws, not a glyph in the markup.
  const card =
    `<div class="inv palette-${design.palette} type-${design.typography} ` +
    `layout-${design.layout} ornament-${design.ornament}">` +
    `<div class="inv-ornament" aria-hidden="true"></div>` +
    `<h2 class="inv-title">${escapeHtml(example.copy.title)}</h2>` +
    `<p class="inv-greeting">${escapeHtml(example.copy.greeting)}</p>` +
    `<p class="inv-body">${escapeHtml(example.copy.body)}</p>` +
    `<p class="inv-details">${escapeHtml(example.copy.details_line)}</p>` +
    `<p class="inv-rsvp">${escapeHtml(example.copy.rsvp_prompt)}</p>` +
    `<p class="inv-closing">${escapeHtml(example.copy.closing)}</p>` +
    `</div>`;
  return (
    `<article class="gl-example">${card}` +
    `<div class="gl-example-foot">` +
    `<div class="gl-example-style">${escapeHtml(example.style)}</div>` +
    `<div class="gl-example-note">${escapeHtml(example.styleNote)}</div>` +
    `<a class="gl-use" href="/create?sample=${encodeURIComponent(example.id)}">` +
    `${escapeHtml(GALLERY[example.brief.language].use)}</a>` +
    `</div></article>`
  );
}

export function galleryOccasionBodyHtml(occasion: OccasionId, lang: Language): string {
  const t = GALLERY[lang];
  const examples = galleryFor(occasion, lang)
    .map((e) => exampleHtml(e, GALLERY_DESIGNS[e.id]))
    .join("");
  const others = populatedOccasions(lang)
    .filter((o) => o !== occasion)
    .map(
      (o) => `<a class="gl-chip" href="/gallery/${o}">${escapeHtml(t.occasions[o])}</a>`,
    )
    .join("");
  return (
    `<div class="gl">` +
    `<nav class="gl-crumbs"><a href="/">${escapeHtml(t.home)}</a>` +
    `<a href="/gallery">${escapeHtml(t.hubTitle)}</a>` +
    `<span>${escapeHtml(t.occasions[occasion])}</span></nav>` +
    `<h1>${escapeHtml(t.occasionTitle[occasion])}</h1>` +
    `<p class="gl-intro">${escapeHtml(t.occasionIntro[occasion])}</p>` +
    `<div class="gl-examples">${examples}</div>` +
    `<section class="gl-others"><h2>${escapeHtml(t.otherOccasions)}</h2>${others}</section>` +
    `</div>`
  );
}

export function galleryHubBodyHtml(lang: Language): string {
  const t = GALLERY[lang];
  const tiles = populatedOccasions(lang)
    .map((o) => {
      const first = galleryFor(o, lang)[0];
      return (
        `<a class="gl-tile" href="/gallery/${o}">` +
        `<div class="gl-tile-name">${escapeHtml(t.occasions[o])}</div>` +
        `<div class="gl-tile-sample">${escapeHtml(first.copy.title)}</div>` +
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
```

Replace `landingPrerenderBlocks` with:

```ts
/** Every prerendered block: the landing page, the gallery hub and each
 *  occasion, in both languages. The server keeps one (`prerenderKey` +
 *  `selectPrerender`) and strips the rest. */
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
```

Add the imports this needs at the top of the file:

```ts
import { GALLERY, LANDING } from "./i18n";
import { galleryFor, GALLERY_DESIGNS, OCCASION_IDS, populatedOccasions } from "./gallery";
import type { GalleryExample } from "./gallery";
import type { DesignTokens, Language } from "./types";
import type { OccasionId } from "./gallery/occasions";
```

In `web/vite.config.ts`, rename the plugin to `inv-prerender` and change the call from `landingPrerenderBlocks()` to `prerenderBlocks()`.

> **Note for the implementer:** `GALLERY` in `i18n.ts` does not exist yet — it is created in Task 5. Do Task 5's Step 3 (the `GALLERY` table) first if the typecheck blocks you, or write the table now and let Task 5 add its tests. The two tasks are split for review, not for ordering.

- [ ] **Step 8: Run both suites**

Run: `pnpm --filter inv-app-web exec vitest run test/prerender.test.ts`
Run: `pnpm --filter inv-app-server exec vitest run test/seo.test.ts`
Expected: PASS both.

- [ ] **Step 9: Commit**

```bash
git add web/src/prerender.ts web/vite.config.ts web/test/prerender.test.ts server/src/seo.ts server/src/app.ts server/test/seo.test.ts
git commit -m "Prerender the gallery, one block per page and language (adr-017 §6)"
```

---

### Task 5: Gallery UI strings, screens, styles and routes

**Files:**
- Create: `web/src/GalleryHubPage.tsx`, `web/src/GalleryOccasionPage.tsx`, `web/src/components/gallery/ExampleCard.tsx`
- Modify: `web/src/i18n.ts`, `web/src/AppRoutes.tsx`, `web/src/styles.css`
- Test: `web/test/GalleryOccasionPage.test.tsx`

**Interfaces:**
- Consumes: `galleryFor`, `findSample`, `GALLERY_DESIGNS`, `populatedOccasions`, `isOccasionId` (Task 2).
- Produces: `GALLERY: Record<Language, GalleryStrings>` in `i18n.ts`, with fields `home`, `hubTitle`, `hubIntro`, `otherOccasions`, `use`, `notFound`, `occasions: Record<OccasionId, string>`, `occasionTitle: Record<OccasionId, string>`, `occasionIntro: Record<OccasionId, string>`.

- [ ] **Step 1: Write the failing test**

`web/test/GalleryOccasionPage.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GalleryOccasionPage } from "../src/GalleryOccasionPage";

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gallery/:occasion" element={<GalleryOccasionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GalleryOccasionPage", () => {
  it("renders the four wedding examples", () => {
    renderAt("/gallery/wedding");
    expect(screen.getByText("Ми одружуємось!")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Взяти цей/ })).toHaveLength(4);
  });

  it("points each use-this link at the sample", () => {
    renderAt("/gallery/wedding");
    const links = screen.getAllByRole("link", { name: /Взяти цей/ });
    expect(links[0].getAttribute("href")).toBe("/create?sample=wedding-romantic");
  });

  it("says the link is dead for an unknown occasion", () => {
    renderAt("/gallery/nope");
    expect(screen.queryByText("Ми одружуємось!")).toBeNull();
    expect(screen.getByText(/Такої сторінки немає/)).toBeTruthy();
  });

  it("shows the four examples in four different palettes", () => {
    const { container } = renderAt("/gallery/wedding");
    const palettes = [...container.querySelectorAll("[class*='palette-']")].map((el) =>
      [...el.classList].find((c) => c.startsWith("palette-")),
    );
    expect(new Set(palettes).size).toBe(4);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/GalleryOccasionPage.test.tsx`
Expected: FAIL — cannot resolve `../src/GalleryOccasionPage`.

- [ ] **Step 3: Add the `GALLERY` strings table**

In `web/src/i18n.ts`, add the interface and the table beside `LANDING`:

```ts
export interface GalleryStrings {
  home: string;
  hubTitle: string;
  hubIntro: string;
  otherOccasions: string;
  /** The call to action under every example. */
  use: string;
  notFound: string;
  occasions: Record<OccasionId, string>;
  occasionTitle: Record<OccasionId, string>;
  occasionIntro: Record<OccasionId, string>;
}

export const GALLERY: Record<Language, GalleryStrings> = {
  uk: {
    home: "Головна",
    hubTitle: "Зразки запрошень",
    hubIntro:
      "Готові тексти для шести подій. Виберіть свою — далі можна взяти будь-який зразок, змінити слова й дизайн, і надіслати гостям посилання.",
    otherOccasions: "Інші події",
    use: "Взяти цей",
    notFound: "Такої сторінки немає. Подивіться зразки для інших подій.",
    occasions: {
      wedding: "Весілля",
      birthday: "День народження",
      kids: "Дитяче свято",
      christening: "Хрестини",
      corporate: "Корпоратив",
      jubilee: "Ювілей",
    },
    occasionTitle: {
      wedding: "Запрошення на весілля: готові тексти",
      birthday: "Запрошення на день народження: готові тексти",
      kids: "Запрошення на дитяче свято: готові тексти",
      christening: "Запрошення на хрестини: готові тексти",
      corporate: "Запрошення на корпоратив: готові тексти",
      jubilee: "Запрошення на ювілей: готові тексти",
    },
    occasionIntro: {
      wedding:
        "Чотири готові запрошення, які можна взяти й змінити під себе — слова, шрифт і кольори вже підібрані. Виберіть те, що звучить як ви, допишіть дату й місце, і надішліть гостям посилання.",
      birthday:
        "Готові тексти запрошення на день народження — від теплого до зовсім короткого. Візьміть будь-який, змініть під свою подію й збирайте відповіді.",
      kids:
        "Запрошення на дитяче свято — яскраві, прості й зрозумілі батькам. Оберіть зразок і допишіть, коли і де святкуєте.",
      christening:
        "Стримані й теплі тексти запрошення на хрестини. Візьміть зразок, допишіть деталі й надішліть рідним посилання.",
      corporate:
        "Запрошення на корпоратив і новорічну вечірку компанії. Оберіть тон, змініть слова під себе й зберіть відповіді колег.",
      jubilee:
        "Урочисті й теплі запрошення на ювілей. Візьміть зразок, допишіть дату й місце, і надішліть гостям посилання.",
    },
  },
  en: {
    home: "Home",
    hubTitle: "Invitation templates",
    hubIntro:
      "Ready-made wording for six occasions. Pick yours — then take any sample, change the words and the design, and send your guests a link.",
    otherOccasions: "Other occasions",
    use: "Use this one",
    notFound: "There is no such page. Have a look at the other occasions.",
    occasions: {
      wedding: "Wedding",
      birthday: "Birthday",
      kids: "Kids party",
      christening: "Christening",
      corporate: "Office party",
      jubilee: "Anniversary",
    },
    occasionTitle: {
      wedding: "Wedding invitation wording",
      birthday: "Birthday invitation wording",
      kids: "Kids party invitation wording",
      christening: "Christening invitation wording",
      corporate: "Office party invitation wording",
      jubilee: "Anniversary invitation wording",
    },
    occasionIntro: {
      wedding:
        "Four ready-made invitations you can take and make your own — the words, the type and the colours are already chosen. Pick the one that sounds like you, add your date and place, and send your guests a link.",
      birthday:
        "Ready-made birthday invitation wording, from warm to very short. Take any of them, adjust it to your event, and collect replies.",
      kids:
        "Invitations for a children's party — bright, simple, and clear to other parents. Pick a sample and add when and where you're celebrating.",
      christening:
        "Quiet, warm wording for a christening invitation. Take a sample, add the details, and send your family a link.",
      corporate:
        "Invitations for a company party or an end-of-year event. Choose the tone, make the words yours, and collect your colleagues' replies.",
      jubilee:
        "Formal and warm anniversary invitations. Take a sample, add your date and place, and send your guests a link.",
    },
  },
};
```

Import `OccasionId` at the top of `i18n.ts`: `import type { OccasionId } from "./gallery/occasions";`

- [ ] **Step 4: Write the example card**

`web/src/components/gallery/ExampleCard.tsx`:

```tsx
import { InvitationPreview } from "../InvitationPreview";
import type { GalleryExample } from "../../gallery";
import type { DesignTokens } from "../../types";

/** One ready-to-use invitation and its call to action.
 *
 *  Exactly one filled accent per example (adr-017 §2, the rule adr-010 §3 set
 *  for the share panel): the card is the content, `gl-use` is the only thing
 *  asking to be pressed.
 *
 *  The CTA is an `<a href>`, never a `<Link>` — a crawler needs a real edge to
 *  follow, and a full page load is what makes `?sample=` reload-safe. */
export function ExampleCard({
  example,
  design,
  useLabel,
}: {
  example: GalleryExample;
  design: DesignTokens;
  useLabel: string;
}) {
  return (
    <article className="gl-example">
      <InvitationPreview copy={example.copy} design={design} />
      <div className="gl-example-foot">
        <div>
          <div className="gl-example-style">{example.style}</div>
          <div className="gl-example-note">{example.styleNote}</div>
        </div>
        <a className="gl-use" href={`/create?sample=${encodeURIComponent(example.id)}`}>
          {useLabel}
        </a>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Write the two screens**

`web/src/GalleryOccasionPage.tsx`:

```tsx
import { Link, useParams } from "react-router-dom";
import { ExampleCard } from "./components/gallery/ExampleCard";
import { galleryFor, GALLERY_DESIGNS, isOccasionId, populatedOccasions } from "./gallery";
import { GALLERY } from "./i18n";
import { useUiLanguage } from "./hooks/useUiLanguage";

/** `/gallery/:occasion` — the page written to rank (adr-017 §1).
 *
 *  An unrecognised slug renders a dead-link state rather than the marketing
 *  page: `shellMeta` has already told the crawler this URL is `noindex`, and
 *  serving landing copy under it is exactly the duplicate that rule declines.
 *  Same shape as `isInvitationId` guarding `:id` (adr-011 §3). */
export function GalleryOccasionPage() {
  const { occasion } = useParams();
  const lang = useUiLanguage();
  const t = GALLERY[lang];

  if (!occasion || !isOccasionId(occasion)) {
    return (
      <div className="gl gl-empty">
        <p>{t.notFound}</p>
        <Link to="/gallery">{t.hubTitle}</Link>
      </div>
    );
  }

  const examples = galleryFor(occasion, lang);
  const others = populatedOccasions(lang).filter((o) => o !== occasion);

  return (
    <div className="gl">
      <nav className="gl-crumbs">
        <Link to="/">{t.home}</Link>
        <Link to="/gallery">{t.hubTitle}</Link>
        <span>{t.occasions[occasion]}</span>
      </nav>
      <h1>{t.occasionTitle[occasion]}</h1>
      <p className="gl-intro">{t.occasionIntro[occasion]}</p>
      <div className="gl-examples">
        {examples.map((example) => (
          <ExampleCard
            key={example.id}
            example={example}
            design={GALLERY_DESIGNS[example.id]}
            useLabel={t.use}
          />
        ))}
      </div>
      <section className="gl-others">
        <h2>{t.otherOccasions}</h2>
        <div className="gl-chips">
          {others.map((o) => (
            <Link className="gl-chip" key={o} to={`/gallery/${o}`}>
              {t.occasions[o]}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
```

`web/src/GalleryHubPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { galleryFor, populatedOccasions } from "./gallery";
import { GALLERY } from "./i18n";
import { useUiLanguage } from "./hooks/useUiLanguage";

/** `/gallery` — the hub. Two modest jobs: give a crawler a path to the six
 *  occasion pages, and let a visitor pick theirs. No filled accent anywhere;
 *  the tile is the link (adr-017 §1). */
export function GalleryHubPage() {
  const lang = useUiLanguage();
  const t = GALLERY[lang];

  return (
    <div className="gl">
      <h1>{t.hubTitle}</h1>
      <p className="gl-intro">{t.hubIntro}</p>
      <div className="gl-tiles">
        {populatedOccasions(lang).map((o) => (
          <Link className="gl-tile" key={o} to={`/gallery/${o}`}>
            <span className="gl-tile-name">{t.occasions[o]}</span>
            <span className="gl-tile-sample">{galleryFor(o, lang)[0].copy.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**`useUiLanguage` does not exist yet — create it in this step.** `LandingPage.tsx:60-67` resolves the language inline with `langFromSearch(location.search) ?? loadUiLang()` and an effect that calls `saveUiLang(urlLang)`. Extract that verbatim into `web/src/hooks/useUiLanguage.ts` and have `LandingPage.tsx` use it too — `?lang=` winning over the stored preference and writing it is adr-016 §5's rule, and a second copy of it will drift:

```ts
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { langFromSearch, loadUiLang, saveUiLang } from "../i18n";
import type { Language } from "../types";

/** The UI language for a page that a crawler may also request.
 *
 *  `?lang=` wins over the stored preference and then writes it (adr-016 §5):
 *  it is the more specific answer, and a crawler has no stored preference at
 *  all — the parameter is the only address the English pages have. Extracted
 *  from `LandingPage` when the gallery became the second surface needing it. */
export function useUiLanguage(): Language {
  const location = useLocation();
  const urlLang = langFromSearch(location.search);
  const [lang, setLang] = useState<Language>(() => urlLang ?? loadUiLang());

  useEffect(() => {
    if (!urlLang) return;
    setLang(urlLang);
    saveUiLang(urlLang);
  }, [urlLang]);

  return lang;
}
```

Check the exact names `LandingPage.tsx` imports for `langFromSearch`, `loadUiLang` and `saveUiLang` and match them; `LandingPage.tsx` keeps its own `setLang` for the toggle, so replace only the initial resolution there, not the toggle.

- [ ] **Step 6: Add the routes**

In `web/src/AppRoutes.tsx`, add above the `*` route:

```tsx
        <Route path="/gallery" element={<GalleryHubPage />} />
        <Route path="/gallery/:occasion" element={<GalleryOccasionPage />} />
```

and import both screens. Update the file's header comment to list six routes.

- [ ] **Step 7: Add the styles**

Append a `.gl-*` block to `web/src/styles.css`, following the `.lp-*` conventions already in the file — page background `#f6f5f2`, ink `#23211d`, muted `#6b6659`, border `#e4ddd0`, accent `#b3592e`, `Playfair Display` for headings. Required rules:

```css
.gl { max-width: 1080px; margin: 0 auto; padding: 28px 20px 56px; }
.gl h1 { font-family: var(--lp-display); font-size: 2.2rem; line-height: 1.15; margin: 0 0 14px; }
.gl-intro { color: #6b6659; line-height: 1.65; max-width: 70ch; margin: 0 0 34px; }
.gl-crumbs { display: flex; gap: 7px; font-size: 0.8rem; color: #8d8577; margin-bottom: 18px; }
.gl-crumbs a { color: inherit; }
.gl-examples { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
.gl-example-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 14px; }
.gl-example-style { font-size: 0.92rem; font-weight: 700; color: #23211d; }
.gl-example-note { font-size: 0.82rem; color: #8d8577; margin-top: 2px; }
.gl-use { display: inline-flex; align-items: center; height: 44px; padding: 0 20px; border-radius: 12px; background: #b3592e; color: #fff; font-weight: 700; font-size: 0.9rem; text-decoration: none; }
.gl-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.gl-tile { display: block; background: #fff; border: 1px solid #e4ddd0; border-radius: 18px; padding: 20px; text-decoration: none; color: inherit; }
.gl-tile-name { display: block; font-family: var(--lp-display); font-size: 1.2rem; margin-bottom: 4px; }
.gl-tile-sample { display: block; font-size: 0.84rem; color: #8d8577; }
.gl-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.gl-chip { font-size: 0.88rem; color: #6b6659; border: 1px solid #e4ddd0; border-radius: 999px; padding: 9px 16px; background: #fff; text-decoration: none; }
.gl-others { margin-top: 40px; padding-top: 26px; border-top: 1px solid #e4ddd0; }
.gl-empty { text-align: center; padding: 80px 20px; color: #6b6659; }

@media (max-width: 800px) {
  .gl-examples { grid-template-columns: 1fr; }
  .gl-tiles { grid-template-columns: 1fr; }
  .gl-example-foot { flex-direction: column; align-items: stretch; }
  .gl-use { justify-content: center; }
}
```

Note: `styles.css` is excluded from Biome formatting on purpose — keep the file's existing compact idiom.

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter inv-app-web exec vitest run test/GalleryOccasionPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Typecheck, lint, commit**

Run: `pnpm --filter inv-app-web exec tsc --noEmit`
Run: `pnpm lint`

```bash
git add web/src/GalleryHubPage.tsx web/src/GalleryOccasionPage.tsx web/src/components/gallery web/src/i18n.ts web/src/AppRoutes.tsx web/src/styles.css web/src/hooks/useUiLanguage.ts web/test/GalleryOccasionPage.test.tsx
git commit -m "Add the gallery hub and occasion screens (adr-017 §1, §2)"
```

---

### Task 6: Seed the editor from a sample

**Files:**
- Create: `web/src/hooks/useGallerySample.ts`
- Modify: `web/src/hooks/useInvitationEditor.ts`, `web/src/App.tsx`
- Test: `web/test/useGallerySample.test.ts`, `web/test/useInvitationEditor.test.ts` (extend)

**Interfaces:**
- Consumes: `findSample`, `sampleInvitation` (Task 2).
- Produces: `useGallerySample(lang: Language): GallerySample | null`. `useInvitationEditor(chat, source, restored, seededDescription?)` — fourth parameter `string` defaulting to `""`.

- [ ] **Step 1: Write the failing hook test**

`web/test/useGallerySample.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useGallerySample } from "../src/hooks/useGallerySample";

function wrapper(path: string) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [path] }, children);
}

describe("useGallerySample", () => {
  it("resolves a known sample", () => {
    const { result } = renderHook(() => useGallerySample("uk"), {
      wrapper: wrapper("/create?sample=wedding-romantic"),
    });
    expect(result.current?.example.id).toBe("wedding-romantic");
    expect(result.current?.example.brief.date).toBeNull();
  });

  it("is null with no parameter", () => {
    const { result } = renderHook(() => useGallerySample("uk"), {
      wrapper: wrapper("/create"),
    });
    expect(result.current).toBeNull();
  });

  it("is null for an unknown sample", () => {
    const { result } = renderHook(() => useGallerySample("uk"), {
      wrapper: wrapper("/create?sample=nope"),
    });
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/useGallerySample.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

`web/src/hooks/useGallerySample.ts`:

```ts
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { findSample, type GallerySample } from "../gallery";
import type { Language } from "../types";

/** The gallery sample this editor session was opened with (adr-017 §4).
 *
 *  Deliberately the same shape as `useReferralSource`: captured once at mount,
 *  because the seeding it drives happens on the editor's first render and the
 *  parameter is gone from the address bar by the next one. Stripping goes
 *  through the router — never `history.replaceState` (adr-011 §4) — and
 *  `replace` rather than a push, so the back button does not re-arm it.
 *
 *  One parameter, not two: `?sample=` names the example, and its presence is
 *  what marks the session as coming from the gallery. */
export function useGallerySample(lang: Language): GallerySample | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [sample] = useState<GallerySample | null>(() =>
    findSample(new URLSearchParams(location.search).get("sample") ?? "", lang),
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("sample")) return;
    params.delete("sample");
    // Any other query parameter survives — this owns `sample` and nothing else.
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  return sample;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter inv-app-web exec vitest run test/useGallerySample.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing editor test**

Append to `web/test/useInvitationEditor.test.ts` (create with the same imports the file already uses if it does not exist):

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useInvitationEditor } from "../src/hooks/useInvitationEditor";
import { findSample, sampleInvitation } from "../src/gallery";
import { UI } from "../src/i18n";

describe("seeding from a gallery sample", () => {
  const sample = findSample("wedding-romantic", "uk")!;
  const invitation = sampleInvitation(sample);

  it("starts active with the sample already loaded", () => {
    const { result } = renderHook(() =>
      useInvitationEditor(UI.uk.chat, "gallery", invitation, sample.example.sentence),
    );
    expect(result.current.phase).toBe("active");
    expect(result.current.invitation?.copy.title).toBe("Ми одружуємось!");
  });

  it("asks for the date once, because a sample never has one", () => {
    const { result } = renderHook(() =>
      useInvitationEditor(UI.uk.chat, "gallery", invitation, sample.example.sentence),
    );
    const nudges = result.current.messages.filter((m) => m.text === UI.uk.chat.dateNudge);
    expect(nudges).toHaveLength(1);
  });

  it("does not block publishing on a sample", () => {
    const { result } = renderHook(() =>
      useInvitationEditor(UI.uk.chat, "gallery", invitation, sample.example.sentence),
    );
    expect(result.current.dateBlocked).toBe(false);
  });
});
```

The chat strings live inside `UI` as `UI[lang].chat` (`i18n.ts:84`), which is what `App.tsx` passes as `t.chat` — there is no separate `CHAT` export.

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/useInvitationEditor.test.ts -t "asks for the date once"`
Expected: FAIL — no nudge is emitted; the hook takes three parameters.

- [ ] **Step 7: Lift the date check and seed the description**

In `web/src/hooks/useInvitationEditor.ts`:

Change the signature and the `description` initial state:

```ts
export function useInvitationEditor(
  chat: ChatStrings,
  source: GenerateSource = "direct",
  restored: Invitation | null = null,
  /** The sentence a gallery sample was generated from (adr-017 §4). Seeds
   *  `description` so the host's next chat turn builds on this event instead
   *  of generating an unrelated one from "12 жовтня" alone. Empty for every
   *  other entry point, including the restored sign-in draft, whose transcript
   *  is deliberately not restored. */
  seededDescription = "",
) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<Phase>(restored ? "active" : "empty");
  const [description, setDescription] = useState(seededDescription);
```

Extract the date check out of `send()` into a function beside `say`:

```ts
  /** What the chat says about an invitation's date, wherever it came from.
   *
   *  A date too vague to parse costs the guest what no date costs them —
   *  GuestActions hides add-to-calendar — so both get the nudge, once per
   *  session (FR-1.7). A date already gone by blocks publishing (FR-1.8), so
   *  it is said on **every** turn it is still true rather than once: a reason
   *  that scrolls off the top of the log does not explain a disabled button.
   *
   *  Lifted out of `send` for adr-017 §4 — a gallery sample never goes through
   *  a generate, and a sample always has a null date, so leaving this inside
   *  the generate handler meant nobody was ever asked when the event was. */
  function noteDateState(inv: Invitation) {
    const start = parseEventStart(inv.brief.date, inv.brief.time);
    if (!start) {
      if (!datePrompted.current) {
        datePrompted.current = true;
        say(chat.dateNudge);
      }
    } else if (isPastEventStart(start)) {
      say(chat.pastDateBlock);
    }
  }
```

Replace the inline block in `send()` (currently lines 68–75) with `noteDateState(inv);`.

Add the seed effect, after the `say` definition:

```ts
  // Ref-guarded rather than state-guarded: StrictMode runs effects twice on
  // the same instance, and a state guard would let the second pass through
  // before the first had committed — the same reason adr-014 §2's sign-in
  // resume is ref-guarded.
  const seedAnnounced = useRef(false);
  useEffect(() => {
    if (!restored || seedAnnounced.current) return;
    seedAnnounced.current = true;
    noteDateState(restored);
    // `restored` is the mount-time invitation and never changes identity for
    // the life of this hook; the ref is what actually guards re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Add `useEffect` to the React import.

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter inv-app-web exec vitest run test/useInvitationEditor.test.ts`
Expected: PASS, including the pre-existing generate-path tests.

- [ ] **Step 9: Wire it into App.tsx**

In `web/src/App.tsx`:

```tsx
  const sample = useGallerySample(lang);
  // A parked sign-in draft wins over `?sample=` (adr-017 §4): someone
  // returning from Google is mid-publish, and the sample is a stale parameter
  // from before the redirect.
  const seeded = draft?.invitation ?? (sample ? sampleInvitation(sample) : null);
  const editor = useInvitationEditor(
    t.chat,
    draft?.source ?? (sample ? "gallery" : source),
    seeded,
    draft ? "" : (sample?.example.sentence ?? ""),
  );
```

Import `useGallerySample` and `sampleInvitation`. `lang` is the UI language already resolved in this component.

- [ ] **Step 10: Typecheck, lint, commit**

Run: `pnpm --filter inv-app-web exec tsc --noEmit`
Run: `pnpm --filter inv-app-web exec vitest run`

```bash
git add web/src/hooks/useGallerySample.ts web/src/hooks/useInvitationEditor.ts web/src/App.tsx web/test/useGallerySample.test.ts web/test/useInvitationEditor.test.ts
git commit -m "Seed the editor from a gallery sample, with no model call (adr-017 §4)"
```

---

### Task 7: Attribution — `gallery` as a source, and the publish counted

**Files:**
- Modify: `server/src/schemas.ts`, `web/src/types.ts`, `server/src/metrics.ts`, `server/src/routes/invitations.ts`, `web/src/api.ts`, `web/src/hooks/usePublishing.ts`
- Test: `server/test/metrics.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GenerateSource` includes `"gallery"`. `recordPublish(source?: GenerateSource)`. Counters `gallery_generations`, `gallery_publishes`.

- [ ] **Step 1: Write the failing test**

Append to `server/test/metrics.test.ts`:

```ts
describe("gallery attribution", () => {
  it("counts a gallery generation in both totals", async () => {
    const m = await freshMetrics();
    m.recordGeneration("gallery");
    m.recordGeneration("direct");

    const snapshot = m.metricsSnapshot();
    expect(snapshot.gallery_generations).toBe(1);
    expect(snapshot.generations).toBe(2);
    // A gallery arrival is not a share-loop referral.
    expect(snapshot.referred_generations).toBe(0);
  });

  it("counts a gallery publish that had no generation at all", async () => {
    const m = await freshMetrics();
    // Exactly the host adr-017 §7 is about: took a sample, edited by hand,
    // published. No generate ever ran.
    m.recordPublish("gallery");

    const snapshot = m.metricsSnapshot();
    expect(snapshot.gallery_publishes).toBe(1);
    expect(snapshot.publishes).toBe(1);
    expect(snapshot.generations).toBe(0);
  });

  it("defaults to direct, so a client that predates adr-017 keeps working", async () => {
    const m = await freshMetrics();
    m.recordPublish();

    const snapshot = m.metricsSnapshot();
    expect(snapshot.publishes).toBe(1);
    expect(snapshot.gallery_publishes).toBe(0);
  });

  it("starts a counter absent from an older metrics.json at zero", async () => {
    writeFileSync(
      join(dataDir, "metrics.json"),
      JSON.stringify({ generations: 5, publishes: 2 }),
    );

    const m = await freshMetrics();
    const snapshot = m.metricsSnapshot();
    expect(snapshot.gallery_publishes).toBe(0);
    expect(snapshot.gallery_generations).toBe(0);
    // The missing keys must not reset the file that had real numbers in it.
    expect(snapshot.generations).toBe(5);
    expect(snapshot.publishes).toBe(2);
  });
});
```

The surrounding file gives each case its own `DATA_DIR` via `beforeEach` and re-imports the module with `freshMetrics()` rather than resetting a cache — follow that, and note `metricsSnapshot()` is the reader, not `readMetrics`.

**Watch the first test in the file:** `it("persists counters and reloads them on restart")` asserts `metricsSnapshot()` with `toEqual`, so adding two keys to the snapshot **will break it**. Add `gallery_generations: 0` and `gallery_publishes: 0` to that expected object.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter inv-app-server exec vitest run test/metrics.test.ts`
Expected: FAIL — `"gallery"` is not a `GenerateSource`, `recordPublish` takes no argument.

- [ ] **Step 3: Widen the enum on both sides**

In `server/src/schemas.ts`, add `"gallery"` to the `GenerateSource` zod enum. In `web/src/types.ts`:

```ts
// Share-loop attribution (adr-013 §3, widened by adr-017 §7): where the host
// arrived from. A closed enum and never the referring invitation id — a third
// origin value carries no id and builds no host graph, which is what adr-013
// actually forbade.
export type GenerateSource = "direct" | "guest" | "gallery";
```

- [ ] **Step 4: Add the counters**

In `server/src/metrics.ts`, add to `Counters` and `SCALAR_COUNTERS`:

```ts
const SCALAR_COUNTERS = [
  "generations",
  "backgrounds",
  "publishes",
  "rsvps",
  "invitation_views",
  "referred_generations",
  "gallery_generations",
  "gallery_publishes",
] as const satisfies readonly (keyof Counters)[];
```

Extend the recorders:

```ts
export function recordGeneration(source: GenerateSource = "direct"): void {
  const c = counters();
  c.generations += 1;
  if (source === "guest") c.referred_generations += 1;
  if (source === "gallery") c.gallery_generations += 1;
  persist();
}

/** The source matters here and not only on a generate: a gallery visitor can
 *  take a sample, hand-edit it and publish with **no generation at all**
 *  (adr-017 §7). Attributing only generations would score exactly the host
 *  this channel exists to produce as invisible. */
export function recordPublish(source: GenerateSource = "direct"): void {
  const c = counters();
  c.publishes += 1;
  if (source === "gallery") c.gallery_publishes += 1;
  persist();
}
```

Add both keys to `Counters` as `number`.

- [ ] **Step 5: Carry the source through the publish request**

In `server/src/schemas.ts`, add an optional `source: GenerateSource` to the publish request schema. In the publish route, pass it to `recordPublish(body.source)`.

In `web/src/api.ts`:

```ts
export function publishInvitation(
  invitation: Invitation,
  existing?: { id: string; manage_token: string },
  source?: GenerateSource,
): Promise<PublishResult> {
  return post<PublishResult>("/api/invitations/publish", { invitation, ...existing, source });
}
```

In `web/src/hooks/usePublishing.ts`, pass the `source` option the hook already receives:

```ts
        const result = await publishInvitation(
          invitation,
          existing ? { id: existing.id, manage_token: existing.manage_token } : undefined,
          source,
        );
```

- [ ] **Step 6: Run the suites**

Run: `pnpm --filter inv-app-server exec vitest run`
Run: `pnpm --filter inv-app-web exec vitest run`
Expected: PASS both.

- [ ] **Step 7: Write the baseline test**

adr-017 §7 requires a baseline frozen when the gallery ships, as adr-014 did for the auth gate: the gallery adds an acquisition channel, so it changes what `publish_rate` is a rate *of*, and without a mark the before and after get compared as if they measured the same population.

Append to `server/test/metrics.test.ts`:

```ts
describe("gallery baseline", () => {
  it("splits the counters at the moment the gallery ships", async () => {
    const m = await freshMetrics();
    m.recordPublish("direct");
    m.recordGeneration("direct");

    const baseline = m.markBaseline("gallery");
    expect(baseline.reason).toBe("gallery");
    expect(baseline.before.publishes).toBe(1);

    m.recordPublish("gallery");

    const snapshot = m.metricsSnapshot();
    expect(snapshot.baseline?.before.publishes).toBe(1);
    expect(snapshot.baseline?.since.publishes).toBe(1);
    // Lifetime keeps counting across the mark.
    expect(snapshot.publishes).toBe(2);
  });
});
```

`markBaseline(reason: string): Baseline` already exists at `server/src/metrics.ts:202` — this task adds no production code for it, only the test that pins the call, plus the operational step below.

- [ ] **Step 8: Run the test**

Run: `pnpm --filter inv-app-server exec vitest run test/metrics.test.ts`
Expected: PASS.

- [ ] **Step 9: Record the deploy-time action**

Freezing the baseline is a one-off call against production made **at the moment the gallery goes live**, not a code change — the same way adr-014's `auth-gate` baseline was taken. Add it to the deployment notes in `docs/05-deployment.md` under the gallery's release step, naming the reason string `gallery` so it is greppable beside the existing `auth-gate` mark.

Do not call it from application startup: a baseline that re-freezes on every restart is not a baseline.

- [ ] **Step 10: Commit**

```bash
git add server/src/schemas.ts server/src/metrics.ts server/src/routes web/src/types.ts web/src/api.ts web/src/hooks/usePublishing.ts server/test/metrics.test.ts docs/05-deployment.md
git commit -m "Attribute gallery generations and publishes, and freeze a baseline (adr-017 §7)"
```

---

### Task 8: The landing page's entry point

**Files:**
- Modify: `web/src/LandingPage.tsx`, `web/src/prerender.ts`, `web/src/i18n.ts`
- Test: `web/test/prerender.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `web/test/prerender.test.ts`:

```ts
describe("landing entry point", () => {
  it("links to the gallery with a crawlable href", () => {
    const html = prerenderBlocks();
    const { open, close } = prerenderMarkers("landing:uk");
    const block = html.slice(html.indexOf(open), html.indexOf(close));
    expect(block).toContain('href="/gallery"');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter inv-app-web exec vitest run test/prerender.test.ts -t "landing entry point"`
Expected: FAIL.

- [ ] **Step 3: Add the link**

Add `galleryLink` to `LANDING` in both languages — `uk: "Подивитися зразки"`, `en: "Browse templates"`.

In `landingBodyHtml`, add to the nav, beside the wordmark:

```ts
    `<a class="lp-nav-gallery" href="/gallery">${escapeHtml(t.galleryLink)}</a>` +
```

In `LandingPage.tsx`, render the same link in the nav as a `<Link to="/gallery">` with class `lp-nav-gallery`.

Add one rule to `styles.css`:

```css
.lp-nav-gallery { font-size: 0.85rem; color: #6b6659; text-decoration: none; }
```

Deliberately in the nav, not the hero: the hero already has the primary action, and a second one beside it takes weight from it (adr-017 §8's usage note).

- [ ] **Step 4: Run the test, lint, commit**

Run: `pnpm --filter inv-app-web exec vitest run test/prerender.test.ts`

```bash
git add web/src/LandingPage.tsx web/src/prerender.ts web/src/i18n.ts web/src/styles.css web/test/prerender.test.ts
git commit -m "Link the landing page to the gallery with a crawlable edge (adr-017 §8)"
```

---

### Task 9: Parity and distinctness tests over the gallery tables

**Files:**
- Modify: `web/test/i18n.test.ts`, `web/test/gallery.test.ts`

- [ ] **Step 1: Write the tests**

Append to `web/test/gallery.test.ts`:

```ts
import { GALLERY_DESIGNS } from "../src/gallery/designs";
import { OCCASION_IDS } from "../src/gallery/occasions";

describe("gallery table integrity", () => {
  it("gives the two languages the same examples in the same order", () => {
    for (const occasion of OCCASION_IDS) {
      const uk = galleryFor(occasion, "uk").map((e) => e.id);
      const en = galleryFor(occasion, "en").map((e) => e.id);
      expect(en).toEqual(uk);
    }
  });

  it("has design tokens for every example id", () => {
    for (const occasion of OCCASION_IDS) {
      for (const example of galleryFor(occasion, "uk")) {
        expect(GALLERY_DESIGNS[example.id]).toBeDefined();
      }
    }
  });

  it("uses a distinct palette for every example of an occasion", () => {
    for (const occasion of OCCASION_IDS) {
      const examples = galleryFor(occasion, "uk");
      if (examples.length === 0) continue;
      const palettes = examples.map((e) => GALLERY_DESIGNS[e.id].palette);
      // Range is half the promise (adr-017 §2): four cards in one palette tell
      // a visitor the product has one look. Held here rather than by care.
      expect(new Set(palettes).size).toBe(examples.length);
    }
  });

  it("never repeats an example id across occasions", () => {
    const ids = OCCASION_IDS.flatMap((o) => galleryFor(o, "uk").map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("states no date, time, venue or city anywhere, in either language", () => {
    for (const lang of ["uk", "en"] as const) {
      for (const occasion of OCCASION_IDS) {
        for (const example of galleryFor(occasion, lang)) {
          expect(example.brief.date).toBeNull();
          expect(example.brief.time).toBeNull();
          expect(example.brief.venue).toBeNull();
          expect(example.brief.city).toBeNull();
        }
      }
    }
  });

  it("writes no Cyrillic into the English table", () => {
    for (const occasion of OCCASION_IDS) {
      for (const example of galleryFor(occasion, "en")) {
        const text = [...Object.values(example.copy), example.style, example.styleNote].join(" ");
        expect(text).not.toMatch(/[Ѐ-ӿ]/);
      }
    }
  });
});
```

- [ ] **Step 2: Extend the i18n parity walk**

`web/test/i18n.test.ts:46` reads:

```ts
const tables = { AUTH, CRASH, GUEST, LANDING, MANAGE, SEO, UI } as const;
```

Add `GALLERY` to it and to the import on line 2:

```ts
import { AUTH, CRASH, GALLERY, GUEST, LANDING, MANAGE, SEO, UI } from "../src/i18n";

const tables = { AUTH, CRASH, GALLERY, GUEST, LANDING, MANAGE, SEO, UI } as const;
```

That one word puts every gallery UI string under both existing checks — no Cyrillic under `.en`, and identical shapes across languages.

- [ ] **Step 3: Run and commit**

Run: `pnpm --filter inv-app-web exec vitest run test/gallery.test.ts test/i18n.test.ts`
Expected: PASS.

```bash
git add web/test/gallery.test.ts web/test/i18n.test.ts
git commit -m "Hold the gallery tables' parity, distinctness and datelessness by test"
```

---

### Task 10: The remaining five occasions

**Files:**
- Modify: `web/src/gallery/content.uk.ts`, `web/src/gallery/content.en.ts`, `web/src/gallery/designs.ts`

**Interfaces:** no new exports; the tables from Task 2 gain five more keys each.

- [ ] **Step 1: Confirm a provider key is available**

Run: `curl -s http://localhost:3001/healthz | head -c 400` after `pnpm dev`, or check `server/.env`.
Expected: `llm.providers` shows `groq: true` or `gemini: true`. If neither, the content must be written by hand instead — say so rather than inventing it, and note that Gemini's free tier is ~20 requests/day.

- [ ] **Step 2: Generate candidate copy from the real pipeline**

For each of the twenty remaining examples, send its sentence through the running dev server:

```bash
curl -s -X POST http://localhost:3001/api/invitations/generate \
  -H 'content-type: application/json' \
  -d '{"description":"Святкуємо перший день народження Мілани, запрошуємо друзів із дітьми","source":"direct"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(JSON.stringify({copy:j.copy,brief:j.brief,design:j.design},null,2))})"
```

Use these sentences verbatim. Four per occasion, written to pull the pipeline toward four different tones — and none of them names a date, a time or a venue, because §3's rule starts at the input:

**birthday**
1. `Святкую день народження в колі родини, запрошую найрідніших`
2. `Round-number birthday — запрошую колег і друзів на святкування`
3. `Збираємось у саду на мій день народження, без офіціозу`
4. `Коротке сучасне запрошення на день народження`

**kids**
1. `День народження доньки — торт, ігри та багато сміху, запрошуємо друзів`
2. `Тематична вечірка на сім років, запрошуємо дітей і батьків`
3. `Збираємось на дитячому майданчику відсвяткувати день народження`
4. `Коротке яскраве запрошення на дитяче свято`

**christening**
1. `Хрестини доньки у родинному колі, запрошуємо найближчих`
2. `Урочисте запрошення на хрестини для хрещених батьків і родини`
3. `Запрошуємо близьких друзів розділити з нами хрестини сина`
4. `Коротке сучасне запрошення на хрестини`

**corporate**
1. `Новорічна вечірка компанії, запрошуємо всю команду`
2. `Урочистий корпоративний вечір, офіційне запрошення для співробітників`
3. `Збираємось командою у неформальній обстановці відзначити результати року`
4. `Коротке запрошення колегам на корпоратив`

**jubilee**
1. `Ювілей шістдесят років, збираємо родину за одним столом`
2. `Урочистий прийом з нагоди ювілею, офіційне запрошення для гостей`
3. `Збираємо давніх друзів відсвяткувати ювілей у теплому колі`
4. `Коротке сучасне запрошення на ювілей`

For the English table, run the same twenty again with each sentence written in English — the pipeline detects language from the input, so an English sentence returns English copy and `brief.language: "en"`. Sentence 2 of **birthday** above deliberately mixes scripts; write it as `Ювілейний день народження — запрошую колег і друзів` for the Ukrainian run and `A milestone birthday — inviting colleagues and friends` for the English one.

Store each example's sentence in its `sentence` field exactly as sent: Task 6 seeds the editor's `description` from it, so it has to be the real input, not a paraphrase.

- [ ] **Step 3: Review every result before it enters the repo**

Read each generated `copy` block and check three things, editing by hand where it fails:

1. It reads as a finished save-the-date with **no date, time or venue** — the pipeline writes around a missing date, but confirm it did not invent one. If `details_line` names a date, replace it with a save-the-date line.
2. The Ukrainian is natural. This is the product's public face; a native read is the point of this step.
3. It does not repeat another example of the same occasion.

- [ ] **Step 4: Add the entries**

For each example, add to `content.uk.ts` and `content.en.ts` using Task 2's `brief()` helper, and add its `DesignTokens` to `GALLERY_DESIGNS`. Every occasion's four examples must use **four different palettes** — Task 9's distinctness test enforces it. Suggested spread per occasion, avoiding four identical assignments across the gallery:

- birthday: `warm`/`serif`/`classic`/`floral`, `festive`/`serif`/`banner`/`none`, `playful`/`sans`/`classic`/`sparkle`, `minimal`/`sans`/`classic`/`none`
- kids: `playful`/`sans`/`banner`/`sparkle`, `warm`/`sans`/`classic`/`sparkle`, `festive`/`serif`/`classic`/`geometric`, `minimal`/`sans`/`classic`/`none`
- christening: `minimal`/`serif`/`classic`/`none`, `elegant`/`serif`/`classic`/`floral`, `warm`/`script`/`classic`/`floral`, `romantic`/`serif`/`split`/`none`
- corporate: `elegant`/`sans`/`banner`/`none`, `festive`/`sans`/`classic`/`geometric`, `minimal`/`sans`/`classic`/`none`, `warm`/`serif`/`split`/`geometric`
- jubilee: `festive`/`serif`/`classic`/`geometric`, `elegant`/`serif`/`banner`/`none`, `warm`/`serif`/`classic`/`floral`, `minimal`/`sans`/`classic`/`none`

Ids follow `<occasion>-<style>`: `birthday-warm`, `birthday-formal`, `birthday-relaxed`, `birthday-minimal`, and the same four style suffixes for each occasion.

- [ ] **Step 5: Run the full web suite**

Run: `pnpm --filter inv-app-web exec vitest run`
Expected: PASS — Task 9's parity, distinctness, dateless and Cyrillic checks all now cover twenty-four examples.

- [ ] **Step 6: Commit**

```bash
git add web/src/gallery
git commit -m "Add the remaining five occasions' invitation texts (adr-017 §2)"
```

---

### Task 11: Bundle measurement and the docs pass

**Files:**
- Modify: `docs/02-functional-requirements.md`, `docs/03-non-functional-requirements.md`, `docs/06-roadmap.md`, `CLAUDE.md`, `.design-sync/NOTES.md`

- [ ] **Step 1: Measure the bundle**

Run: `pnpm --filter inv-app-web build`
Then measure the gzipped main chunk:

```bash
node -e "const z=require('zlib'),f=require('fs');const p=f.readdirSync('web/dist/assets').find(n=>n.endsWith('.js'));console.log(p, (z.gzipSync(f.readFileSync('web/dist/assets/'+p)).length/1024).toFixed(1)+' kB gz');"
```

Record the number. **If it exceeds ~100 kB, adr-017 §5's revisit trigger has fired** — stop and report it rather than proceeding; moving the content server-side is a design change, not a cleanup.

- [ ] **Step 2: Add FR-14 and amend FR-13.2**

In `docs/02-functional-requirements.md`, add a `## FR-14 Invitation gallery` section with sub-requirements covering: the seven pages and their addresses (FR-14.1), examples as full dateless invitations (FR-14.2), the seeding CTA with no model call (FR-14.3), four visibly different examples per occasion (FR-14.4), and an unknown occasion rendering a dead link (FR-14.5). Amend FR-13.2 in place to say the landing page **and the gallery** are offered for indexing, with a pointer to adr-017 §1.

- [ ] **Step 3: Record the bundle under NFR-1**

Update NFR-1's "The client bundle is part of this budget" line with the measured figure and a note that adr-017 §5 sets ~100 kB as the trigger to move gallery content server-side.

- [ ] **Step 4: Catch the roadmap up**

`docs/06-roadmap.md` owes three sections, not one:

1. `## Shipped: public discoverability` — FR-13 / adr-016, which shipped 2026-08-21 with only a backlog strikethrough.
2. `## Shipped: the missing-date nudge and the past-date gate` — FR-1.7 / FR-1.8, shipped 2026-09-05, absent entirely.
3. `## Shipped: the invitation gallery` — this iteration.

Replace `## No iteration currently taken` with the 2026-09-11 reading (the table from adr-017's Context), and re-score the candidate backlog: strike the gallery, mark the RSVP-prompt item **cold** (six regenerations, unchanged in 34 days), and add a new observation that `backgrounds` is 0 lifetime — a shipped feature with its own ADR that nobody has ever used.

- [ ] **Step 5: Update CLAUDE.md**

Add a gallery paragraph to the Architecture section covering: the content tables and the hand-mirrored occasion list, `InvitationPreview` reused with no second renderer, prerendering now per (path × language) and why it must not be tidied away, `?sample=` seeding the `restored` path, and `GenerateSource` gaining `gallery` with the publish attributed. Add `GALLERY` to the i18n paragraph's list of tables.

- [ ] **Step 6: Update `.design-sync/NOTES.md`**

Two things: add `gallery`, `brand-name` and `feedback-sheet` to the templates list that guards against sweeping the project, and record the finding — **the Claude Design app does not recompile `_ds_manifest.json` for this project; only the CLI resync writes it**, so a new template set stays invisible until its manifest entry is added by hand, whatever `@template` marker it carries.

- [ ] **Step 7: Full verification**

Run: `pnpm test`
Run: `pnpm typecheck`
Run: `pnpm lint`
Run: `pnpm build`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add docs CLAUDE.md .design-sync/NOTES.md
git commit -m "Record the invitation gallery as FR-14, and catch the roadmap up"
```
