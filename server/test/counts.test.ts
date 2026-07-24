// Batch response counts for the returning-host landing list (adr-012).
//
// The property that matters most is the last test in the first block: the
// batch and the per-invitation dashboard endpoint must report the same numbers
// for the same record, because a row that disagrees with the screen it links
// to is worse than a row with no number on it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Invitation, Rsvp } from "../src/schemas.js";

const invitation: Invitation = {
  brief: {
    event_type: "housewarming",
    hosts: ["Марта"],
    date: "3 вересня",
    time: "17:00",
    venue: "вул. Личаківська 12",
    city: "Львів",
    tone: "warm",
    language: "uk",
    extra_details: null,
  },
  copy: {
    title: "Новосілля",
    greeting: "Друзі!",
    body: "Запрошуємо на новосілля.",
    details_line: "3 вересня, 17:00",
    rsvp_prompt: "Підтвердіть, будь ласка.",
    closing: "Марта",
  },
  design: { palette: "warm", typography: "serif", layout: "classic", ornament: "none" },
};

let app: FastifyInstance;
let dataDir: string;
let addRsvp: typeof import("../src/store.js").addRsvp;
let getRecord: typeof import("../src/store.js").getRecord;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-app-counts-"));
  process.env.DATA_DIR = dataDir;
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ logger: false });
  ({ addRsvp, getRecord } = await import("../src/store.js"));
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function publish(): Promise<{ id: string; token: string }> {
  const response = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation },
  });
  const { id, manage_token } = response.json();
  return { id, token: manage_token };
}

/** Seeds answers with controlled timestamps through the store, so the
 *  `new_since` cases don't depend on how many milliseconds a test takes. */
function seed(id: string, rsvps: Array<Partial<Rsvp> & { name: string; created_at: string }>) {
  for (const rsvp of rsvps) {
    const record = getRecord(id);
    if (!record) throw new Error(`seed: no record ${id}`);
    addRsvp(record, {
      attending: true,
      guests_count: 1,
      note: null,
      ...rsvp,
    });
  }
}

function counts(items: unknown[]) {
  return app.inject({ method: "POST", url: "/api/invitations/counts", payload: { items } });
}

describe("batch response counts", () => {
  it("returns counts per invitation and agrees with the dashboard endpoint", async () => {
    const { id, token } = await publish();
    seed(id, [
      { name: "Іван", created_at: "2026-08-01T10:00:00.000Z", guests_count: 2 },
      { name: "Оксана", created_at: "2026-08-01T11:00:00.000Z", attending: false },
      { name: "Богдан", created_at: "2026-08-01T12:00:00.000Z", guests_count: 3 },
    ]);

    const response = await counts([{ id, token }]);
    expect(response.statusCode).toBe(200);
    // Per-host data keyed by secrets — nothing in between may retain it.
    expect(response.headers["cache-control"]).toBe("no-store");
    const [result] = response.json().results;
    expect(result).toMatchObject({ id, status: "ok" });
    expect(result.counts).toEqual({ yes: 2, no: 1, guests: 5 });

    // The whole point of sharing summarizeRsvps (adr-012 §3).
    const dashboard = await app.inject({
      method: "GET",
      url: `/api/invitations/${id}/rsvps`,
      headers: { "x-manage-token": token },
    });
    expect(result.counts).toEqual(dashboard.json().counts);
  });

  it("excludes superseded answers from counts, like the dashboard does", async () => {
    const { id, token } = await publish();
    seed(id, [
      { name: "Оксана Литвин", created_at: "2026-08-01T10:00:00.000Z", attending: false },
      // Same guest, later, different answer — replaces the one above.
      { name: "оксана  литвин", created_at: "2026-08-02T10:00:00.000Z", guests_count: 2 },
    ]);

    const [result] = (await counts([{ id, token }])).json().results;
    expect(result.counts).toEqual({ yes: 1, no: 0, guests: 2 });
  });

  it("never returns guest names — counts only", async () => {
    const { id, token } = await publish();
    seed(id, [{ name: "Приватне Імʼя", created_at: "2026-08-01T10:00:00.000Z" }]);

    const body = (await counts([{ id, token }])).body;
    expect(body).not.toContain("Приватне");
    expect(JSON.parse(body).results[0]).not.toHaveProperty("rsvps");
  });
});

describe("batch authorization", () => {
  it("answers each item on its own: one bad token never blanks the others", async () => {
    const a = await publish();
    const b = await publish();
    seed(a.id, [{ name: "Іван", created_at: "2026-08-01T10:00:00.000Z" }]);
    seed(b.id, [{ name: "Марія", created_at: "2026-08-01T10:00:00.000Z" }]);

    const response = await counts([
      { id: a.id, token: a.token },
      // Right shape, wrong invitation — b's token must not open a.
      { id: b.id, token: a.token },
      { id: "notreal1", token: a.token },
    ]);

    expect(response.statusCode).toBe(200);
    const { results } = response.json();
    expect(results.map((r: { status: string }) => r.status)).toEqual([
      "ok",
      "forbidden",
      "not_found",
    ]);
    expect(results[0].counts).toEqual({ yes: 1, no: 0, guests: 1 });
    // Refusals carry a status and nothing else: no counts, no error prose.
    expect(results[1]).toEqual({ id: b.id, status: "forbidden" });
  });

  it("rejects a malformed body and an over-cap batch as whole-batch 400s", async () => {
    const { id, token } = await publish();

    expect((await counts([{ id }])).statusCode).toBe(400);
    expect((await counts([{ id, token: "" }])).statusCode).toBe(400);
    expect((await counts([])).statusCode).toBe(400);
    expect(
      (await app.inject({ method: "POST", url: "/api/invitations/counts", payload: {} }))
        .statusCode,
    ).toBe(400);

    // 26 items: truncating would show a host some events with counts and some
    // without for no visible reason, so the batch is refused instead.
    const over = Array.from({ length: 26 }, () => ({ id, token }));
    expect((await counts(over)).statusCode).toBe(400);
    expect((await counts(over.slice(0, 25))).statusCode).toBe(200);
  });

  it("refuses an id the server could never have minted", async () => {
    const { token } = await publish();
    expect((await counts([{ id: "../../etc/passwd", token }])).statusCode).toBe(400);
  });
});

describe("new since last visit", () => {
  it("counts live answers newer than the baseline", async () => {
    const { id, token } = await publish();
    seed(id, [
      { name: "Іван", created_at: "2026-08-01T10:00:00.000Z" },
      { name: "Марія", created_at: "2026-08-05T10:00:00.000Z" },
      { name: "Богдан", created_at: "2026-08-06T10:00:00.000Z" },
    ]);

    const [result] = (await counts([{ id, token, seen_at: "2026-08-03T00:00:00.000Z" }])).json()
      .results;
    expect(result.new_since).toBe(2);
  });

  it("reports zero without a baseline, rather than treating everything as new", async () => {
    const { id, token } = await publish();
    seed(id, [{ name: "Іван", created_at: "2026-08-01T10:00:00.000Z" }]);

    const [result] = (await counts([{ id, token }])).json().results;
    expect(result.counts).toEqual({ yes: 1, no: 0, guests: 1 });
    expect(result.new_since).toBe(0);
  });

  it("does not count a superseded answer as news", async () => {
    const { id, token } = await publish();
    seed(id, [
      // Both answers land after the baseline, so only the superseded filter can
      // tell them apart: counting timestamps alone would report 2. One guest
      // changing their mind is one piece of news, not two.
      { name: "Оксана", created_at: "2026-08-02T10:00:00.000Z", attending: false },
      { name: "Оксана", created_at: "2026-08-03T10:00:00.000Z" },
    ]);

    const [result] = (await counts([{ id, token, seen_at: "2026-08-01T00:00:00.000Z" }])).json()
      .results;
    expect(result.new_since).toBe(1);
    expect(result.counts).toEqual({ yes: 1, no: 0, guests: 1 });
  });
});
