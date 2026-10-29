import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetGuardrails } from "../src/guardrails.js";
import type { Invitation } from "../src/schemas.js";

/**
 * The RSVP endpoint's per-IP allowance (adr-008, amended). It is the only
 * unauthenticated write, each reply rewrites the whole record, and the link is
 * made to be posted in group chats, so one client gets a day's allowance of
 * replies across every invitation, like the LLM endpoints do.
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

const reply = { name: "Ірина", answer: "yes", guests_count: 2 };

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

beforeEach(() => {
  resetGuardrails();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function publish(): Promise<{ id: string; manage_token: string }> {
  return (
    await app.inject({ method: "POST", url: "/api/invitations/publish", payload: { invitation } })
  ).json();
}

function rsvp(id: string, ip: string, payload: Record<string, unknown> = reply) {
  return app.inject({
    method: "POST",
    url: `/api/invitations/${id}/rsvp`,
    headers: { "x-forwarded-for": ip },
    payload,
  });
}

async function stored(id: string, token: string): Promise<number> {
  const summary = await app.inject({
    method: "GET",
    url: `/api/invitations/${id}/rsvps`,
    headers: { "x-manage-token": token },
  });
  return summary.json().rsvps.length;
}

describe("the RSVP endpoint's per-IP allowance", () => {
  it("answers 429 once an IP has used the day's allowance, and stores nothing", async () => {
    vi.stubEnv("LIMIT_RSVPS_PER_DAY", "2");
    const { id, manage_token } = await publish();

    expect((await rsvp(id, "203.0.113.20")).statusCode).toBe(200);
    expect((await rsvp(id, "203.0.113.20")).statusCode).toBe(200);
    const limited = await rsvp(id, "203.0.113.20");
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toMatch(/tomorrow/);
    // Another guest's connection keeps its own allowance.
    expect((await rsvp(id, "203.0.113.21")).statusCode).toBe(200);

    expect(await stored(id, manage_token)).toBe(3);
  });

  it("counts an IP's replies across every invitation", async () => {
    vi.stubEnv("LIMIT_RSVPS_PER_DAY", "1");
    const first = await publish();
    const second = await publish();

    expect((await rsvp(first.id, "203.0.113.22")).statusCode).toBe(200);
    expect((await rsvp(second.id, "203.0.113.22")).statusCode).toBe(429);
  });

  it("spends nothing on a dead link or a malformed reply", async () => {
    vi.stubEnv("LIMIT_RSVPS_PER_DAY", "1");
    const { id } = await publish();

    expect((await rsvp("deadbeef", "203.0.113.23")).statusCode).toBe(404);
    expect((await rsvp(id, "203.0.113.23", { name: "" })).statusCode).toBe(400);
    expect((await rsvp(id, "203.0.113.23")).statusCode).toBe(200);
  });

  it("is off at 0", async () => {
    vi.stubEnv("LIMIT_RSVPS_PER_DAY", "0");
    const { id } = await publish();
    for (let i = 0; i < 5; i++) {
      expect((await rsvp(id, "203.0.113.24")).statusCode).toBe(200);
    }
  });
});
