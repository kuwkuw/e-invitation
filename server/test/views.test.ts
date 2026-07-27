import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Invitation } from "../src/schemas.js";
import { resetViewDedupe } from "../src/views.js";

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

let app: FastifyInstance;
let dataDir: string;
let id: string;

async function views(): Promise<number> {
  const response = await app.inject({ method: "GET", url: "/api/metrics" });
  return response.json().invitation_views;
}

function beacon(invitationId: string, ip: string) {
  return app.inject({
    method: "POST",
    url: `/api/invitations/${invitationId}/view`,
    remoteAddress: ip,
  });
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-views-test-"));
  process.env.DATA_DIR = dataDir;
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ logger: false });
  const published = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation },
  });
  id = published.json().id;
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  resetViewDedupe();
});

describe("view beacon (adr-013)", () => {
  it("counts a view and answers 204 with no body", async () => {
    const before = await views();
    const response = await beacon(id, "203.0.113.10");
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(await views()).toBe(before + 1);
  });

  it("counts the same reader once, and still answers 204", async () => {
    const before = await views();
    await beacon(id, "203.0.113.20");
    const repeat = await beacon(id, "203.0.113.20");
    // The repeat is not the caller's business — a guest must never be able to
    // tell whether their view recorded.
    expect(repeat.statusCode).toBe(204);
    expect(await views()).toBe(before + 1);
  });

  it("counts a different reader of the same invitation separately", async () => {
    const before = await views();
    await beacon(id, "203.0.113.30");
    await beacon(id, "203.0.113.31");
    expect(await views()).toBe(before + 2);
  });

  it("counts the same reader on a second invitation", async () => {
    const other = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation },
    });
    const before = await views();
    await beacon(id, "203.0.113.40");
    await beacon(other.json().id, "203.0.113.40");
    expect(await views()).toBe(before + 2);
  });

  it("counts nothing for an invitation the server never minted", async () => {
    const before = await views();
    const unknown = await beacon("Zm9vYmFy", "203.0.113.50");
    expect(unknown.statusCode).toBe(404);
    expect(await views()).toBe(before);
  });

  it("counts nothing for a malformed id, without touching the store", async () => {
    const before = await views();
    // Fails InvitationId before any filesystem lookup — the same guard the
    // public endpoints use against path traversal (NFR-4).
    const malformed = await beacon("..%2F..%2Fetc", "203.0.113.60");
    expect(malformed.statusCode).toBe(404);
    // Our handler's body, not the router's — proving the id reached the guard
    // rather than being rejected by path matching, which is what makes this a
    // test of the guard at all.
    expect(malformed.json()).toEqual({ error: "Invitation not found." });
    expect(await views()).toBe(before);
  });
});
