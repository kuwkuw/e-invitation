import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { DesignTokens, type Invitation } from "../src/schemas.js";
import { OG_PALETTES, OG_TYPOGRAPHY, renderOgPng } from "../src/og/render.js";

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

  it("404s for unknown invitations", async () => {
    const res = await app.inject({ method: "GET", url: "/i/nope-nope" });
    expect(res.statusCode).toBe(404);
  });
});
