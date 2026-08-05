import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import type { Invitation } from "../src/schemas.js";

function invitation(title: string): Invitation {
  return {
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
      title,
      greeting: "Дорогі друзі!",
      body: "Запрошуємо вас відсвяткувати разом із нами.",
      details_line: "12 серпня, 18:00",
      rsvp_prompt: "Підтвердіть свою присутність.",
      closing: "З любов'ю, Олена",
    },
    design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
  };
}

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-claim-test-"));
  process.env.DATA_DIR = dataDir;
  app = await buildApp({ logger: false });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await app.close();
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

function signIn(googleSub = "google-sub-1") {
  const user = upsertUser(googleSub, `${googleSub}@example.com`);
  return { user, cookies: { inv_session: createSession(user.id).id } };
}

/** Published with nobody signed in — the case claiming exists for. */
async function publishAnonymously(title: string): Promise<{ id: string; manage_token: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation: invitation(title) },
  });
  return res.json();
}

function claim(items: { id: string; token: string }[], cookies?: Record<string, string>) {
  return app.inject({
    method: "POST",
    url: "/api/account/claim",
    payload: { items },
    ...(cookies ? { cookies } : {}),
  });
}

function keyringTitles(body: { invitations: { title: string }[] }): string[] {
  return body.invitations.map((e) => e.title);
}

describe("claim", () => {
  it("refuses without a session", async () => {
    const published = await publishAnonymously("Anonymous");
    const res = await claim([{ id: published.id, token: published.manage_token }]);
    expect(res.statusCode).toBe(401);
  });

  it("refuses cross-origin", async () => {
    const { cookies } = signIn();
    const published = await publishAnonymously("Anonymous");
    const res = await app.inject({
      method: "POST",
      url: "/api/account/claim",
      payload: { items: [{ id: published.id, token: published.manage_token }] },
      cookies,
      headers: { origin: "https://evil.example", host: "localhost:3001" },
    });
    expect(res.statusCode).toBe(403);
  });

  // The whole point: an invitation published before the host had an account
  // becomes one the account knows, so it survives onto the next device.
  it("files an anonymous publish into the account", async () => {
    const { cookies } = signIn();
    const published = await publishAnonymously("Пікнік у парку");

    const before = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(keyringTitles(before.json())).toEqual([]);

    const res = await claim([{ id: published.id, token: published.manage_token }], cookies);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [{ id: published.id, status: "ok" }], linked: 1 });
    // A batch of credentials on the way in, like the keyring is on the way out.
    expect(res.headers["cache-control"]).toBe("no-store");

    const after = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(keyringTitles(after.json())).toEqual(["Пікнік у парку"]);
  });

  // A browser that has held tokens for a year has some that no longer resolve.
  // One of them must not cost the host the rest of their events (adr-012 §2).
  it("answers per item, so one bad token cannot fail the batch", async () => {
    const { cookies } = signIn();
    const good = await publishAnonymously("Good");
    const wrongToken = await publishAnonymously("Wrong token");

    const res = await claim(
      [
        { id: good.id, token: good.manage_token },
        { id: wrongToken.id, token: "f".repeat(32) },
        { id: "zzzzzzzz", token: good.manage_token },
      ],
      cookies,
    );

    expect(res.json().results).toEqual([
      { id: good.id, status: "ok" },
      { id: wrongToken.id, status: "forbidden" },
      { id: "zzzzzzzz", status: "not_found" },
    ]);
    expect(res.json().linked).toBe(1);

    const after = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(keyringTitles(after.json())).toEqual(["Good"]);
  });

  // `linked` counts rows inserted, not items that succeeded: the UI may only
  // say "N invitations are now in your account" the first time.
  it("is idempotent and reports nothing linked the second time", async () => {
    const { cookies } = signIn();
    const published = await publishAnonymously("Twice");
    const items = [{ id: published.id, token: published.manage_token }];

    expect((await claim(items, cookies)).json().linked).toBe(1);

    const again = await claim(items, cookies);
    expect(again.json()).toEqual({ results: [{ id: published.id, status: "ok" }], linked: 0 });

    const after = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(keyringTitles(after.json())).toEqual(["Twice"]);
  });

  // A keyring is an index, not a deed. Two people holding the same manage link
  // are two people the product cannot tell apart, and the token goes on
  // working for both regardless (adr-014 §1) — so claiming must not be a race
  // one of them loses.
  it("does not make the link exclusive", async () => {
    const first = signIn("google-sub-1");
    const second = signIn("google-sub-2");
    const published = await publishAnonymously("Shared");
    const items = [{ id: published.id, token: published.manage_token }];

    expect((await claim(items, first.cookies)).json().linked).toBe(1);
    expect((await claim(items, second.cookies)).json().linked).toBe(1);

    for (const cookies of [first.cookies, second.cookies]) {
      const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
      expect(keyringTitles(res.json())).toEqual(["Shared"]);
    }
  });

  it("rejects a batch over the cap rather than truncating it", async () => {
    const { cookies } = signIn();
    const published = await publishAnonymously("Capped");
    const items = Array.from({ length: 51 }, () => ({
      id: published.id,
      token: published.manage_token,
    }));

    const res = await claim(items, cookies);
    expect(res.statusCode).toBe(400);

    // Nothing was filed: a rejected batch is a batch that did not happen.
    const after = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(keyringTitles(after.json())).toEqual([]);
  });
});
