import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSession, linkInvitation, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { ensurePref, getPref, notificationTargets } from "../src/notifications.js";
import { pageLanguage } from "../src/unsubscribePage.js";

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-unsub-test-"));
  process.env.DATA_DIR = dataDir;
  app = await buildApp({ logger: false });
});

afterEach(async () => {
  await app.close();
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

/** A signed-in host holding one invitation, with a minted token. */
function host(googleSub = "google-sub-1") {
  const user = upsertUser(googleSub, `${googleSub}@example.com`);
  createSession(user.id);
  linkInvitation(user.id, "inv12345");
  return { user, token: ensurePref(user.id).unsub_token };
}

const get = (url: string, headers?: Record<string, string>) =>
  app.inject({ method: "GET", url, ...(headers ? { headers } : {}) });

/** As a mail provider's one-click sends it: form-encoded, cross-origin. */
const oneClick = (token: string) =>
  app.inject({
    method: "POST",
    url: `/unsubscribe/${token}`,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: "List-Unsubscribe=One-Click",
  });

describe("unsubscribe", () => {
  // The property the whole route shape exists for. Mail scanners, corporate
  // link checkers and Gmail's proxy follow links in mail with no human — a GET
  // that unsubscribed would opt hosts out via their own provider, silently.
  describe("GET never mutates", () => {
    it("offers a button and leaves the preference alone", async () => {
      const { user, token } = host();

      const res = await get(`/unsubscribe/${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.body).toContain("<form");
      expect(res.body).toContain(`action="/unsubscribe/${token}"`);
      expect(getPref(user.id)?.enabled).toBe(true);
      expect(notificationTargets("inv12345")).toHaveLength(1);
    });

    it("confirms rather than errors when the host is already off", async () => {
      const { user, token } = host();
      await oneClick(token);

      const res = await get(`/unsubscribe/${token}`);

      // Arriving twice should confirm what they asked for, not imply a fault.
      expect(res.body).toContain("Emails are off");
      expect(res.body).not.toContain("<form");
      expect(getPref(user.id)?.enabled).toBe(false);
    });
  });

  describe("POST unsubscribes", () => {
    it("turns reply email off for every invitation the account holds", async () => {
      const { user, token } = host();
      linkInvitation(user.id, "inv99999");

      const res = await oneClick(token);

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("Emails are off");
      expect(getPref(user.id)?.enabled).toBe(false);
      expect(notificationTargets("inv12345")).toEqual([]);
      expect(notificationTargets("inv99999")).toEqual([]);
    });

    // RFC 8058 sends `application/x-www-form-urlencoded`; Fastify parses JSON
    // only, so without a parser the provider's request is a 415 and the header
    // advertises a button that fails.
    it("accepts the form-encoded one-click body", async () => {
      const { token } = host();
      const res = await oneClick(token);
      expect(res.statusCode).toBe(200);
    });

    // The parser that makes the line above work is scoped to these two routes.
    // On the root instance it would teach every endpoint in the app to accept a
    // form body — and form-encoded is the only thing a cross-site HTML form can
    // post, so the 415 everywhere else is a free layer beneath SameSite=Lax and
    // the origin checks on the cookie-authorized mutations.
    it("does not teach the rest of the app to accept a form body", async () => {
      const elsewhere = await app.inject({
        method: "POST",
        url: "/api/auth/signout",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "anything=1",
      });
      expect(elsewhere.statusCode).toBe(415);
    });

    it("is idempotent", async () => {
      const { user, token } = host();

      await oneClick(token);
      const again = await oneClick(token);

      expect(again.statusCode).toBe(200);
      expect(again.body).toContain("Emails are off");
      expect(getPref(user.id)?.enabled).toBe(false);
    });

    it("touches nothing but the preference", async () => {
      const { user, token } = host();

      await oneClick(token);

      // No manage token, no keyring row, no invitation — the host keeps every
      // event and keeps access to every response.
      const { listKeyring } = await import("../src/accounts.js");
      expect(listKeyring(user.id).map((e) => e.invitation_id)).toEqual(["inv12345"]);
    });
  });

  describe("a token we cannot resolve", () => {
    it("says the link no longer works, without saying whether it ever did", async () => {
      const res = await get("/unsubscribe/nosuchtoken");

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("This link no longer works");
      // Nothing that reads as a fault: the host did nothing wrong.
      expect(res.body.toLowerCase()).not.toContain("error");
      expect(res.body.toLowerCase()).not.toContain("invalid");
    });

    it("changes nothing on a POST", async () => {
      const { user } = host();

      const res = await oneClick("nosuchtoken");

      expect(res.body).toContain("This link no longer works");
      expect(getPref(user.id)?.enabled).toBe(true);
    });

    it("refuses a malformed token without touching the store", async () => {
      const res = await get("/unsubscribe/..%2F..%2Fetc%2Fpasswd");
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("This link no longer works");
    });
  });

  describe("the page itself", () => {
    it("needs no external request — no scripts, no webfont link", async () => {
      const { token } = host();
      const res = await get(`/unsubscribe/${token}`);

      expect(res.body).not.toContain("<script");
      expect(res.body).not.toContain("fonts.googleapis");
      expect(res.body).not.toContain("<link");
      // Both icons are inline.
      expect(res.body).toContain("<svg");
    });

    it("is never indexed or cached", async () => {
      const { token } = host();
      const res = await get(`/unsubscribe/${token}`);

      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["x-robots-tag"]).toBe("noindex");
    });

    it("takes its language from the header and lets the reader switch", async () => {
      const { token } = host();

      const uk = await get(`/unsubscribe/${token}`, { "accept-language": "uk-UA,uk;q=0.9" });
      expect(uk.body).toContain("Вимкнути листи про відповіді?");

      const forced = await get(`/unsubscribe/${token}?lang=en`, {
        "accept-language": "uk-UA,uk;q=0.9",
      });
      expect(forced.body).toContain("Turn off reply emails?");
      // The switcher keeps the token, or the next click is a dead link.
      expect(uk.body).toContain(`/unsubscribe/${token}?lang=en`);
    });
  });

  describe("pageLanguage", () => {
    it("prefers Ukrainian only when the header ranks it first", () => {
      expect(pageLanguage("uk-UA,uk;q=0.9,en;q=0.8")).toBe("uk");
      expect(pageLanguage("en-GB,en;q=0.9,uk;q=0.8")).toBe("en");
      expect(pageLanguage(undefined)).toBe("en");
      expect(pageLanguage("de-DE")).toBe("en");
    });

    it("lets an explicit choice win, and ignores anything else", () => {
      expect(pageLanguage("en-GB", "uk")).toBe("uk");
      expect(pageLanguage("uk-UA", "en")).toBe("en");
      expect(pageLanguage("uk-UA", "fr")).toBe("uk");
    });
  });
});
