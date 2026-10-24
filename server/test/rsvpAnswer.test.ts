import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Invitation } from "../src/schemas.js";

/**
 * «Ще не знаю» on the server (adr-019 §9.1). The answer is stored beside
 * `attending` rather than in place of it, and these tests hold the three
 * things that shape exists for: a maybe never adds to the headcount, a record
 * written before the maybe reads the same, and a record written after it
 * reads right on the code it replaced, which is what a revert runs.
 */

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

const TOKEN = "f".repeat(32);
const T = "2026-10-01T10:00:00.000Z";

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

function rsvp(id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "POST", url: `/api/invitations/${id}/rsvp`, payload });
}

async function rsvps(id: string, token: string) {
  return (
    await app.inject({
      method: "GET",
      url: `/api/invitations/${id}/rsvps`,
      headers: { "x-manage-token": token },
    })
  ).json();
}

const answers = (summary: { rsvps: { answer: string }[] }) => summary.rsvps.map((r) => r.answer);

describe("the maybe reply on the server (adr-019 §9.1)", () => {
  it("counts a maybe beside yes and no, and never in the headcount", async () => {
    const { id, manage_token } = await publish();
    for (const payload of [
      { name: "Ірина", answer: "yes", guests_count: 3 },
      { name: "Тарас", answer: "maybe", guests_count: 4 },
      { name: "Марко", answer: "no" },
    ]) {
      expect((await rsvp(id, payload)).statusCode).toBe(200);
    }
    const summary = await rsvps(id, manage_token);
    expect(summary.counts).toEqual({ yes: 1, no: 1, maybe: 1, guests: 3 });
    expect(answers(summary)).toEqual(["yes", "maybe", "no"]);
  });

  // The revert path. The reader this step replaces tests `attending` for
  // truthiness; what this step writes must read right there.
  it("stores a maybe so a reader that predates it counts it as a no", async () => {
    const { id } = await publish();
    await rsvp(id, { name: "Тарас", answer: "maybe" });
    const stored = JSON.parse(readFileSync(join(dataDir, `${id}.json`), "utf8"));
    expect(stored.rsvps[0]).toMatchObject({ answer: "maybe", attending: false });
  });

  it("reads a record written before the maybe existed, and leaves it as it was", async () => {
    const id = "legacy01";
    const before = {
      id,
      manage_token: TOKEN,
      versions: [invitation],
      rsvps: [
        { name: "Ірина", attending: true, guests_count: 2, note: null, created_at: T },
        { name: "Марко", attending: false, guests_count: 1, note: null, created_at: T },
      ],
      created_at: T,
      updated_at: T,
    };
    const path = join(dataDir, `${id}.json`);
    const bytes = JSON.stringify(before, null, 2);
    writeFileSync(path, bytes);

    const summary = await rsvps(id, TOKEN);
    expect(answers(summary)).toEqual(["yes", "no"]);
    expect(summary.counts).toEqual({ yes: 1, no: 1, maybe: 0, guests: 2 });
    expect(readFileSync(path, "utf8")).toBe(bytes);
  });

  // A guest page loaded before the deploy, submitting after it.
  it("accepts a reply from a client that sends attending alone", async () => {
    const { id, manage_token } = await publish();
    const response = await rsvp(id, { name: "Ірина", attending: true, guests_count: 2 });
    expect(response.statusCode).toBe(200);
    expect(answers(await rsvps(id, manage_token))).toEqual(["yes"]);
  });

  it("lets the answer win when a client sends both", async () => {
    const { id, manage_token } = await publish();
    await rsvp(id, { name: "Тарас", answer: "maybe", attending: true });
    const summary = await rsvps(id, manage_token);
    expect(summary.counts).toMatchObject({ yes: 0, maybe: 1 });
    const stored = JSON.parse(readFileSync(join(dataDir, `${id}.json`), "utf8"));
    expect(stored.rsvps[0]).toMatchObject({ answer: "maybe", attending: false });
  });

  it("refuses a reply with neither, or with an answer it doesn't know", async () => {
    const { id } = await publish();
    expect((await rsvp(id, { name: "X" })).statusCode).toBe(400);
    expect((await rsvp(id, { name: "X", answer: "perhaps" })).statusCode).toBe(400);
  });
});
