import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  OG_PNG_CACHE_LIMIT,
  recallOgPng,
  rememberOgPng,
  resetOgPngCache,
} from "../src/og/cache.js";
import { OG_PALETTES, OG_TYPOGRAPHY, renderOgPng } from "../src/og/render.js";
import { DesignTokens, type Invitation } from "../src/schemas.js";

const invitation: Invitation = {
  brief: {
    event_type: "birthday",
    hosts: ["Олена"],
    date: "12 серпня",
    time: "18:00",
    venue: "Кафе «Затишок»",
    city: "Львів",
    tone: "warm and familial",
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

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("og token maps", () => {
  it("cover every design-token enum value", () => {
    const shape = DesignTokens.shape;
    for (const palette of shape.palette.options) {
      expect(OG_PALETTES[palette], `palette ${palette}`).toBeDefined();
    }
    for (const typography of shape.typography.options) {
      expect(OG_TYPOGRAPHY[typography], `typography ${typography}`).toBeDefined();
    }
  });
});

describe("og rendering", () => {
  it("renders a PNG for every layout and ornament", async () => {
    const shape = DesignTokens.shape;
    for (const layout of shape.layout.options) {
      for (const ornament of shape.ornament.options) {
        const png = await renderOgPng({
          ...invitation,
          design: { ...invitation.design, layout, ornament },
        });
        expect(png.subarray(0, 4).equals(PNG_MAGIC), `${layout}/${ornament}`).toBe(true);
      }
    }
  }, 60_000);
});

// Driven with dummy buffers rather than through the route: the property under
// test is the eviction, and filling the cache for real would mean rendering
// OG_PNG_CACHE_LIMIT + 1 PNGs, which the suite above already needs 60s for at
// twelve.
describe("og png cache", () => {
  beforeEach(() => {
    resetOgPngCache();
  });

  const png = (n: number) => Buffer.from([n]);

  it("returns what it was given, and misses on an unknown key", () => {
    rememberOgPng("abc:1", png(1));
    expect(recallOgPng("abc:1")).toEqual(png(1));
    // Republishing mints a new key rather than invalidating the old one.
    expect(recallOgPng("abc:2")).toBeUndefined();
  });

  it("evicts the least recently used entry once over the limit", () => {
    for (let i = 0; i <= OG_PNG_CACHE_LIMIT; i++) {
      rememberOgPng(`inv-${i}:1`, png(i));
    }
    // One over the limit: the first key inserted is the one that went.
    expect(recallOgPng("inv-0:1")).toBeUndefined();
    expect(recallOgPng(`inv-${OG_PNG_CACHE_LIMIT}:1`)).toEqual(png(OG_PNG_CACHE_LIMIT));
  });

  it("keeps an entry that is still being read", () => {
    rememberOgPng("popular:1", png(0));
    for (let i = 1; i < OG_PNG_CACHE_LIMIT; i++) {
      rememberOgPng(`inv-${i}:1`, png(i));
      // A hit refreshes recency, so the oldest *insertion* is not the oldest
      // *use* — without that, a link everyone is opening would be evicted by
      // one-off renders of links nobody is.
      expect(recallOgPng("popular:1")).toEqual(png(0));
    }
    rememberOgPng("newcomer:1", png(99));
    rememberOgPng("newest:1", png(98));
    expect(recallOgPng("popular:1")).toEqual(png(0));
    expect(recallOgPng("inv-1:1")).toBeUndefined();
  });
});

describe("og routes", () => {
  let app: FastifyInstance;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "inv-app-og-test-"));
    process.env.DATA_DIR = dataDir;
    const { buildApp } = await import("../src/app.js");
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("serves og.png and a share page with OG meta tags", async () => {
    const published = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation },
    });
    const { id } = published.json();

    const png = await app.inject({ method: "GET", url: `/api/invitations/${id}/og.png` });
    expect(png.statusCode).toBe(200);
    expect(png.headers["content-type"]).toBe("image/png");
    expect(png.rawPayload.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);

    const page = await app.inject({ method: "GET", url: `/i/${id}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain(`og:title" content="Запрошення на день народження"`);
    expect(page.body).toContain(`og:image" content="`);
    expect(page.body).toContain(`/api/invitations/${id}/og.png?v=1`);
  });

  // Copy is directly editable (FR-2.1), so a title is host-controlled text.
  // `String.replace` expands `$&` and friends inside a *string* replacement,
  // and it does so after escapeHtml has run — so the escaping cannot save us.
  // A title of `$&` used to inject the matched `</head>` into the host's own
  // meta tag, closing the head early and mangling the card messengers unfurl.
  it("does not let a $-sequence in the title rewrite the shell", async () => {
    // Every sequence String.replace treats specially in a string replacement.
    const title = "$& $` $' $1 $$";
    const published = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation: { ...invitation, copy: { ...invitation.copy, title } } },
    });
    const { id } = published.json();

    const page = await app.inject({ method: "GET", url: `/i/${id}` });
    expect(page.statusCode).toBe(200);
    // The property under test: the head is closed exactly once. With a string
    // replacement `$&` expanded to the matched `</head>`, closing it twice.
    expect(page.body.match(/<\/head>/g)).toHaveLength(1);
    // And the title reaches the tag intact — `&` HTML-escaped as it should be,
    // every `$` sequence otherwise untouched.
    expect(page.body).toContain(`og:title" content="$&amp; $\` $' $1 $$"`);
  });

  it("404s for unknown invitations", async () => {
    const res = await app.inject({ method: "GET", url: "/i/nope-nope" });
    expect(res.statusCode).toBe(404);
  });
});
