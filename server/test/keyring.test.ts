import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import type { Invitation } from "../src/schemas.js";

function invitation(title: string, palette: Invitation["design"]["palette"]): Invitation {
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
    design: { palette, typography: "serif", layout: "classic", ornament: "floral" },
  };
}

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-keyring-test-"));
  process.env.DATA_DIR = dataDir;
  app = await buildApp({ logger: false });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await app.close();
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

/** A signed-in browser, without going through Google — the handshake has its
 *  own tests, and this file is about what a session then gets to read. */
function signIn(googleSub = "google-sub-1") {
  const user = upsertUser(googleSub, `${googleSub}@example.com`);
  return { user, cookies: { inv_session: createSession(user.id).id } };
}

async function publish(
  inv: Invitation,
  cookies?: Record<string, string>,
): Promise<{ id: string; manage_token: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation: inv },
    ...(cookies ? { cookies } : {}),
  });
  return res.json();
}

describe("keyring", () => {
  it("refuses without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/account/keyring" });
    expect(res.statusCode).toBe(401);
  });

  it("returns what a browser that never cleared storage would hold", async () => {
    const { cookies } = signIn();
    const published = await publish(invitation("День народження Олени", "warm"), cookies);

    const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(res.statusCode).toBe(200);
    // A batch of credentials — nothing between the browser and the process
    // should retain it.
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.json().invitations).toEqual([
      {
        id: published.id,
        // The token is what makes the keyring useful: every host endpoint
        // still checks it, so this is the client getting its key back.
        manage_token: published.manage_token,
        title: "День народження Олени",
        published_at: expect.any(String),
        palette: "warm",
      },
    ]);
  });

  it("never shows one account another's invitations", async () => {
    const host = signIn("google-sub-1");
    const other = signIn("google-sub-2");
    await publish(invitation("Mine", "warm"), host.cookies);
    await publish(invitation("Theirs", "festive"), other.cookies);

    const mine = await app.inject({
      method: "GET",
      url: "/api/account/keyring",
      cookies: host.cookies,
    });
    expect(mine.json().invitations.map((e: { title: string }) => e.title)).toEqual(["Mine"]);
  });

  // adr-014 §1: accounts are additive. Publishing signed out must behave
  // exactly as it did before accounts existed.
  it("does not link an anonymous publish", async () => {
    const { cookies } = signIn();
    const published = await publish(invitation("Anonymous", "warm"));

    const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(res.json().invitations).toEqual([]);
    // And the invitation is perfectly usable — it just belongs to whoever
    // holds the token.
    const rsvps = await app.inject({
      method: "GET",
      url: `/api/invitations/${published.id}/rsvps`,
      headers: { "x-manage-token": published.manage_token },
    });
    expect(rsvps.statusCode).toBe(200);
  });

  it("links a republish, so signing in later claims an invitation", async () => {
    const { cookies } = signIn();
    const published = await publish(invitation("Anonymous first", "warm"));

    // The host signs in and republishes from the browser that still holds the
    // token — which is them telling us the invitation is theirs.
    const again = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      cookies,
      payload: {
        id: published.id,
        manage_token: published.manage_token,
        invitation: invitation("Now claimed", "elegant"),
      },
    });
    expect(again.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(res.json().invitations).toEqual([
      expect.objectContaining({ id: published.id, title: "Now claimed", palette: "elegant" }),
    ]);
  });

  it("reports the latest version's title and palette", async () => {
    const { cookies } = signIn();
    const published = await publish(invitation("First draft", "warm"), cookies);
    await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      cookies,
      payload: {
        id: published.id,
        manage_token: published.manage_token,
        invitation: invitation("Renamed", "festive"),
      },
    });

    const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    // One row, not two — republishing is the same event.
    expect(res.json().invitations).toHaveLength(1);
    expect(res.json().invitations[0]).toMatchObject({ title: "Renamed", palette: "festive" });
  });

  it("skips a keyring row whose record is gone rather than failing the list", async () => {
    const { cookies, user } = signIn();
    const kept = await publish(invitation("Still here", "warm"), cookies);
    // A record deleted underneath the index — the one way a row dangles.
    const { linkInvitation } = await import("../src/accounts.js");
    linkInvitation(user.id, "gone1234");

    const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json().invitations.map((e: { id: string }) => e.id)).toEqual([kept.id]);
  });

  // adr-014 §9. The half that matters is what deletion *doesn't* touch.
  describe("account deletion", () => {
    it("removes the account and leaves every invitation working", async () => {
      const { cookies } = signIn();
      const published = await publish(invitation("Mine", "warm"), cookies);
      await app.inject({
        method: "POST",
        url: `/api/invitations/${published.id}/rsvp`,
        payload: { name: "Іван", attending: true, party_size: 2 },
      });

      const res = await app.inject({ method: "DELETE", url: "/api/account", cookies });
      expect(res.statusCode).toBe(200);
      // Told the true number, so the UI can say what happened rather than
      // implying the invitations went with the account.
      expect(res.json()).toEqual({ deleted: true, invitations_retained: 1 });

      // The session is gone.
      expect(
        (await app.inject({ method: "GET", url: "/api/account/keyring", cookies })).statusCode,
      ).toBe(401);

      // The guest link a host already pasted into a chat still resolves...
      expect(
        (await app.inject({ method: "GET", url: `/api/invitations/${published.id}` })).statusCode,
      ).toBe(200);
      // ...the RSVPs guests left are still there, being the guests' data...
      const rsvps = await app.inject({
        method: "GET",
        url: `/api/invitations/${published.id}/rsvps`,
        headers: { "x-manage-token": published.manage_token },
      });
      expect(rsvps.statusCode).toBe(200);
      expect(rsvps.json().counts.yes).toBe(1);
      // ...and a host who kept their manage link still has access, because the
      // token survives on the record. Deletion removes the account, not the
      // event.
      const republish = await app.inject({
        method: "POST",
        url: "/api/invitations/publish",
        payload: {
          id: published.id,
          manage_token: published.manage_token,
          invitation: invitation("Still mine", "elegant"),
        },
      });
      expect(republish.statusCode).toBe(200);
    });

    it("refuses without a session and cross-origin", async () => {
      expect((await app.inject({ method: "DELETE", url: "/api/account" })).statusCode).toBe(401);

      const { cookies } = signIn();
      const forged = await app.inject({
        method: "DELETE",
        url: "/api/account",
        cookies,
        headers: { origin: "https://evil.example", host: "localhost:3001" },
      });
      expect(forged.statusCode).toBe(403);
    });

    it("does not take another account down with it", async () => {
      const host = signIn("google-sub-1");
      const other = signIn("google-sub-2");
      await publish(invitation("Mine", "warm"), host.cookies);
      await publish(invitation("Theirs", "festive"), other.cookies);

      await app.inject({ method: "DELETE", url: "/api/account", cookies: host.cookies });

      const theirs = await app.inject({
        method: "GET",
        url: "/api/account/keyring",
        cookies: other.cookies,
      });
      expect(theirs.json().invitations.map((e: { title: string }) => e.title)).toEqual(["Theirs"]);
    });

    it("lets the same Google account sign in again as a new, empty account", async () => {
      const { cookies } = signIn("google-sub-1");
      await publish(invitation("Mine", "warm"), cookies);
      await app.inject({ method: "DELETE", url: "/api/account", cookies });

      // Signing in again is a fresh account: the keyring is gone, so the
      // invitation is reachable only by its manage link — exactly what adr-005
      // says a capability token means.
      const fresh = signIn("google-sub-1");
      const res = await app.inject({
        method: "GET",
        url: "/api/account/keyring",
        cookies: fresh.cookies,
      });
      expect(res.json().invitations).toEqual([]);
    });
  });

  it("refuses a session cookie that has been signed out", async () => {
    const { cookies } = signIn();
    await publish(invitation("Mine", "warm"), cookies);
    await app.inject({ method: "POST", url: "/api/auth/signout", cookies });

    const res = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
    expect(res.statusCode).toBe(401);
  });
});
