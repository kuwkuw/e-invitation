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

describe("publish + RSVP", () => {
  it("publishes a snapshot, serves it publicly, and versions republishes", async () => {
    const published = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation },
    });
    expect(published.statusCode).toBe(200);
    const { id, version, manage_token } = published.json();
    expect(version).toBe(1);
    expect(id).toMatch(/^[A-Za-z0-9_-]{6,32}$/);
    expect(manage_token).toHaveLength(32);

    const publicView = await app.inject({ method: "GET", url: `/api/invitations/${id}` });
    expect(publicView.statusCode).toBe(200);
    expect(publicView.json()).toEqual({ id, version: 1, invitation });
    expect(publicView.body).not.toContain(manage_token);

    const edited = { ...invitation, copy: { ...invitation.copy, title: "Нова назва" } };
    const republished = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation: edited, id, manage_token },
    });
    expect(republished.json().version).toBe(2);

    const latest = await app.inject({ method: "GET", url: `/api/invitations/${id}` });
    expect(latest.json().invitation.copy.title).toBe("Нова назва");
  });

  it("rejects republish with a wrong or missing token", async () => {
    const { id } = (
      await app.inject({ method: "POST", url: "/api/invitations/publish", payload: { invitation } })
    ).json();

    const wrong = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation, id, manage_token: "0".repeat(32) },
    });
    expect(wrong.statusCode).toBe(403);

    const missing = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation, id },
    });
    expect(missing.statusCode).toBe(403);
  });

  it("collects RSVPs and exposes them only to the manage token holder", async () => {
    const { id, manage_token } = (
      await app.inject({ method: "POST", url: "/api/invitations/publish", payload: { invitation } })
    ).json();

    for (const rsvp of [
      { name: "Ірина", attending: true, guests_count: 2 },
      { name: "Тарас", attending: true, guests_count: 1, note: "Буду трохи пізніше" },
      { name: "Марко", attending: false },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/invitations/${id}/rsvp`,
        payload: rsvp,
      });
      expect(response.statusCode).toBe(200);
    }

    const denied = await app.inject({ method: "GET", url: `/api/invitations/${id}/rsvps` });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "GET",
      url: `/api/invitations/${id}/rsvps`,
      headers: { "x-manage-token": manage_token },
    });
    expect(allowed.statusCode).toBe(200);
    const summary = allowed.json();
    expect(summary.counts).toEqual({ yes: 2, no: 1, guests: 3 });
    expect(summary.rsvps).toHaveLength(3);
    expect(summary.rsvps[1].note).toBe("Буду трохи пізніше");
    expect(summary.rsvps[2].guests_count).toBe(1);
  });

  it("returns 404 for unknown or malformed ids", async () => {
    for (const url of [
      "/api/invitations/nonexistent1",
      "/api/invitations/..%2F..%2Fetc",
      "/api/invitations/nonexistent1/rsvps",
    ]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(404);
    }

    const rsvp = await app.inject({
      method: "POST",
      url: "/api/invitations/nonexistent1/rsvp",
      payload: { name: "X", attending: true },
    });
    expect(rsvp.statusCode).toBe(404);
  });

  it("rejects invalid RSVP bodies", async () => {
    const { id } = (
      await app.inject({ method: "POST", url: "/api/invitations/publish", payload: { invitation } })
    ).json();

    const bad = await app.inject({
      method: "POST",
      url: `/api/invitations/${id}/rsvp`,
      payload: { name: "", attending: true, guests_count: 99 },
    });
    expect(bad.statusCode).toBe(400);
  });
});
