import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Invitation } from "../src/schemas.js";

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

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-app-test-"));
  process.env.DATA_DIR = dataDir;
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ logger: false });
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function publish(): Promise<{ id: string; manage_token: string }> {
  return (
    await app.inject({ method: "POST", url: "/api/invitations/publish", payload: { invitation } })
  ).json();
}

async function rsvp(id: string, payload: Record<string, unknown>): Promise<void> {
  await app.inject({ method: "POST", url: `/api/invitations/${id}/rsvp`, payload });
}

describe("POST /api/invitations/counts", () => {
  it("returns per-item results and never retains the response", async () => {
    const { id, manage_token } = await publish();
    await rsvp(id, { name: "Ірина", attending: true, guests_count: 2 });
    await rsvp(id, { name: "Марко", attending: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/invitations/counts",
      payload: { items: [{ id, token: manage_token }] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      results: [{ id, status: "ok", counts: { yes: 1, no: 1, guests: 2 }, new_since: 0 }],
    });
    // The batch never discloses guest names (adr-012 §3).
    expect(response.body).not.toContain("Ірина");
  });

  it("mixes ok, forbidden, and not_found in one 200 response", async () => {
    const { id, manage_token } = await publish();
    await rsvp(id, { name: "Тарас", attending: true, guests_count: 1 });

    const response = await app.inject({
      method: "POST",
      url: "/api/invitations/counts",
      payload: {
        items: [
          { id, token: manage_token }, // ok
          { id, token: "0".repeat(32) }, // refused token
          { id: "nonexistent1", token: manage_token }, // unknown record
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const { results } = response.json();
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      id,
      status: "ok",
      counts: { yes: 1, no: 0, guests: 1 },
      new_since: 0,
    });
    expect(results[1]).toEqual({ id, status: "forbidden" });
    expect(results[2]).toEqual({ id: "nonexistent1", status: "not_found" });
  });

  it("counts identically to the single-invitation /rsvps endpoint", async () => {
    const { id, manage_token } = await publish();
    await rsvp(id, { name: "Оксана Литвин", attending: false });
    await rsvp(id, { name: "Богдан", attending: true, guests_count: 1 });
    // Same guest, restyled name: her "no" is superseded by this "yes".
    await rsvp(id, { name: "оксана  литвин", attending: true, guests_count: 3 });

    const single = (
      await app.inject({
        method: "GET",
        url: `/api/invitations/${id}/rsvps`,
        headers: { "x-manage-token": manage_token },
      })
    ).json();

    const batch = (
      await app.inject({
        method: "POST",
        url: "/api/invitations/counts",
        payload: { items: [{ id, token: manage_token }] },
      })
    ).json();

    expect(batch.results[0].counts).toEqual(single.counts);
    expect(batch.results[0].counts).toEqual({ yes: 2, no: 0, guests: 4 });
  });

  it("counts new_since from the client baseline, excluding superseded answers", async () => {
    const { id, manage_token } = await publish();
    await rsvp(id, { name: "Ранній", attending: true, guests_count: 1 });
    const baseline = new Date().toISOString();
    // A tick after the baseline: a fresh answer and a change of mind.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await rsvp(id, { name: "Пізній", attending: true, guests_count: 1 });
    await rsvp(id, { name: "Ранній", attending: false }); // supersedes the first

    const withBaseline = (
      await app.inject({
        method: "POST",
        url: "/api/invitations/counts",
        payload: { items: [{ id, token: manage_token, seen_at: baseline }] },
      })
    ).json();
    // "Пізній" is new; "Ранній"'s change is a live answer newer than the
    // baseline; the superseded original does not count.
    expect(withBaseline.results[0].new_since).toBe(2);

    const withoutBaseline = (
      await app.inject({
        method: "POST",
        url: "/api/invitations/counts",
        payload: { items: [{ id, token: manage_token }] },
      })
    ).json();
    // No baseline is a first visit — 0, not "everything is new" (adr-012 §4).
    expect(withoutBaseline.results[0].new_since).toBe(0);
  });

  it("answers duplicate ids once per occurrence, positionally", async () => {
    const { id, manage_token } = await publish();
    const response = await app.inject({
      method: "POST",
      url: "/api/invitations/counts",
      payload: {
        items: [
          { id, token: manage_token },
          { id, token: "0".repeat(32) },
        ],
      },
    });
    const { results } = response.json();
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("ok");
    expect(results[1].status).toBe("forbidden");
  });

  it("rejects an over-cap batch with 400, never a truncation", async () => {
    const { id, manage_token } = await publish();
    const items = Array.from({ length: 26 }, () => ({ id, token: manage_token }));
    const response = await app.inject({
      method: "POST",
      url: "/api/invitations/counts",
      payload: { items },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects a malformed body with 400", async () => {
    for (const payload of [
      {}, // no items
      { items: [{ token: "x" }] }, // missing id
      { items: [{ id: "../../etc", token: "x" }] }, // id that could never be minted
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/invitations/counts",
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("accepts an empty batch as a well-formed no-op", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/invitations/counts",
      payload: { items: [] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ results: [] });
  });
});
