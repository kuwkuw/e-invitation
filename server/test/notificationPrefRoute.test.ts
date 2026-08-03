import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { notificationTargets } from "../src/notifications.js";
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
  dataDir = mkdtempSync(join(tmpdir(), "inv-notifyroute-test-"));
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

async function publish(cookies?: Record<string, string>): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation: invitation("Мій день") },
    ...(cookies ? { cookies } : {}),
  });
  return res.json().id;
}

/** Same-origin by omission, as the other cookie-mutation tests do — `inject`
 *  defaults `host` to `localhost:80`, so a literal origin has to match that or
 *  it reads as cross-origin. */
function put(enabled: boolean, cookies?: Record<string, string>) {
  return app.inject({
    method: "PUT",
    url: "/api/account/notifications",
    payload: { enabled },
    ...(cookies ? { cookies } : {}),
  });
}

describe("notification preference endpoint", () => {
  // Reply email is opt-in (adr-015 §7, amended). The absence of a row is still
  // the default rather than a stored value — the default itself inverted.
  it("reports disabled for an account with no preference row yet", async () => {
    const { cookies } = signIn();

    const res = await app.inject({
      method: "GET",
      url: "/api/account/notifications",
      cookies,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false });
  });

  it("round-trips a change", async () => {
    const { cookies } = signIn();
    const id = await publish(cookies);

    expect((await put(false, cookies)).json()).toEqual({ enabled: false });
    const read = await app.inject({
      method: "GET",
      url: "/api/account/notifications",
      cookies,
    });
    expect(read.json()).toEqual({ enabled: false });
    expect(notificationTargets(id)).toEqual([]);

    expect((await put(true, cookies)).json()).toEqual({ enabled: true });
    expect(notificationTargets(id)).toHaveLength(1);
  });

  describe("authorization", () => {
    it("refuses a signed-out caller", async () => {
      signIn();

      expect(
        (await app.inject({ method: "GET", url: "/api/account/notifications" })).statusCode,
      ).toBe(401);
      expect((await put(false)).statusCode).toBe(401);
    });

    // The switch is the account's own, so there is no id to authorize and no
    // way to name someone else's — but a second account holding the same
    // invitation must still be unaffected.
    it("changes only the calling account, not a co-holder", async () => {
      const owner = signIn("google-sub-1");
      const second = signIn("google-sub-2");
      const id = await publish(owner.cookies);
      const { linkInvitation } = await import("../src/accounts.js");
      linkInvitation(second.user.id, id);
      // Both asked for mail, or turning one off would prove nothing.
      await put(true, owner.cookies);
      await put(true, second.cookies);

      await put(false, owner.cookies);

      const left = notificationTargets(id);
      expect(left).toHaveLength(1);
      expect(left[0].user_id).toBe(second.user.id);
    });

    // adr-014 §4: the cookie-authorized mutations get an origin check.
    it("refuses a cross-origin write", async () => {
      const { cookies } = signIn();
      const id = await publish(cookies);
      await put(true, cookies);

      const res = await app.inject({
        method: "PUT",
        url: "/api/account/notifications",
        payload: { enabled: false },
        headers: { origin: "https://evil.example", host: "localhost:3001" },
        cookies,
      });

      expect(res.statusCode).toBe(403);
      expect(notificationTargets(id)).toHaveLength(1);
    });

    it("rejects a malformed body", async () => {
      const { cookies } = signIn();

      const res = await app.inject({
        method: "PUT",
        url: "/api/account/notifications",
        payload: { enabled: "yes" },
        cookies,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("the session probe", () => {
    it("reports notifications off when mail is unconfigured", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/session" });
      expect(res.json().notifications).toBe(false);
    });

    it("reports notifications on once mail is configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("NOTIFY_FROM", "INVINTO <replies@invinto.app>");
      const res = await app.inject({ method: "GET", url: "/api/auth/session" });
      expect(res.json().notifications).toBe(true);
    });
  });
});
