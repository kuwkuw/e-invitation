import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSession, deleteUser, linkInvitation, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb, getDb } from "../src/db.js";
import {
  disableByUnsubToken,
  ensurePref,
  getPref,
  lastNotifiedAt,
  markNotified,
  notificationTargets,
  setNotificationsEnabled,
} from "../src/notifications.js";
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
  dataDir = mkdtempSync(join(tmpdir(), "inv-notifications-test-"));
  process.env.DATA_DIR = dataDir;
  app = await buildApp({ logger: false });
});

afterEach(async () => {
  await app.close();
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

function signIn(googleSub = "google-sub-1") {
  const user = upsertUser(googleSub, `${googleSub}@example.com`);
  return { user, cookies: { inv_session: createSession(user.id).id } };
}

async function publish(
  title: string,
  cookies?: Record<string, string>,
): Promise<{ id: string; manage_token: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation: invitation(title) },
    ...(cookies ? { cookies } : {}),
  });
  return res.json();
}

describe("notification preferences", () => {
  // adr-015 §1: the keyring is the eligibility rule. Nothing else decides who
  // hears about an invitation, which is why these two cases come first.
  describe("who is eligible", () => {
    it("makes the publishing host a target when they were signed in", async () => {
      const { user, cookies } = signIn();
      const published = await publish("Мій день народження", cookies);

      const targets = notificationTargets(published.id);
      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        user_id: user.id,
        invitation_id: published.id,
        email: "google-sub-1@example.com",
      });
    });

    // The stated cost of §1, and the common case wherever
    // PUBLISH_REQUIRES_ACCOUNT is off: no account, no address, no notification
    // — silently, and without the host being told they are missing anything.
    it("gives an anonymously published invitation no targets at all", async () => {
      const published = await publish("Анонімне");
      expect(notificationTargets(published.id)).toEqual([]);
    });

    it("gives an unknown invitation no targets", () => {
      expect(notificationTargets("nosuchid")).toEqual([]);
    });
  });

  // The absence of a row is the default, not a missing default — the property
  // the whole §7 design rests on.
  describe("with no preference row", () => {
    it("treats the host as enabled and never notified", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv12345");

      expect(getPref(user.id)).toBeNull();
      expect(notificationTargets("inv12345")).toEqual([
        {
          user_id: user.id,
          invitation_id: "inv12345",
          email: "google-sub-1@example.com",
          last_notified_at: null,
          unsub_token: null,
        },
      ]);
    });
  });

  describe("ensurePref", () => {
    it("creates an enabled row with an unsubscribe token", () => {
      const { user } = signIn();
      const pref = ensurePref(user.id);

      expect(pref.enabled).toBe(true);
      expect(pref.unsub_token).toMatch(/^[\w-]{20,}$/);
      // The send bookkeeping lives elsewhere: this row is the account's
      // answer, not a record of what it has been told.
      expect(lastNotifiedAt(user.id, "inv12345")).toBeNull();
    });

    it("is idempotent and keeps the original token", () => {
      const { user } = signIn();
      const first = ensurePref(user.id);
      const again = ensurePref(user.id);

      expect(again).toEqual(first);
      const rows = getDb().prepare("SELECT COUNT(*) AS n FROM notification_prefs").get() as {
        n: number;
      };
      expect(rows.n).toBe(1);
    });

    // A host who turned mail off and then receives another reply must not be
    // re-enabled by the send path touching the row.
    it("never re-enables a preference the host turned off", () => {
      const { user } = signIn();
      setNotificationsEnabled(user.id, false);

      expect(ensurePref(user.id).enabled).toBe(false);
    });

    // One token per account, not per event: it is the credential behind a
    // mail client's unsubscribe button, and that button promises to stop the
    // sender rather than one of their messages.
    it("mints one token per account, whatever it is asked about", () => {
      const first = signIn("google-sub-1");
      const second = signIn("google-sub-2");

      expect(ensurePref(first.user.id).unsub_token).toBe(ensurePref(first.user.id).unsub_token);
      expect(ensurePref(first.user.id).unsub_token).not.toBe(
        ensurePref(second.user.id).unsub_token,
      );
    });
  });

  describe("enabling and disabling", () => {
    it("drops a disabled host out of the targets and restores them", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv12345");

      setNotificationsEnabled(user.id, false);
      expect(notificationTargets("inv12345")).toEqual([]);

      setNotificationsEnabled(user.id, true);
      expect(notificationTargets("inv12345")).toHaveLength(1);
    });

    // The whole point of the account-level switch: off means off everywhere,
    // because that is what the host was promised when they turned it off.
    it("covers every invitation the account holds, and later ones too", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv11111");
      linkInvitation(user.id, "inv22222");

      setNotificationsEnabled(user.id, false);

      expect(notificationTargets("inv11111")).toEqual([]);
      expect(notificationTargets("inv22222")).toEqual([]);

      // An invitation published after the host opted out is covered without
      // anyone having to remember to write a row for it.
      linkInvitation(user.id, "inv33333");
      expect(notificationTargets("inv33333")).toEqual([]);
    });

    it("creates the row when turning off with none present", () => {
      const { user } = signIn();
      const pref = setNotificationsEnabled(user.id, false);
      expect(pref.enabled).toBe(false);
      expect(getPref(user.id)?.enabled).toBe(false);
    });
  });

  describe("markNotified", () => {
    it("stamps the baseline the window and countNewSince both measure from", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv12345");

      markNotified(user.id, "inv12345", "2026-07-31T10:00:00.000Z");

      expect(lastNotifiedAt(user.id, "inv12345")).toBe("2026-07-31T10:00:00.000Z");
      expect(notificationTargets("inv12345")[0].last_notified_at).toBe("2026-07-31T10:00:00.000Z");
    });

    it("creates the row when there is none, so the sender needs one call", () => {
      const { user } = signIn();
      markNotified(user.id, "inv12345");
      expect(lastNotifiedAt(user.id, "inv12345")).not.toBeNull();
    });

    // The window is per invitation even though the preference is not: a host
    // with two busy events should hear about each, not have one silence the
    // other.
    it("keeps a separate window per invitation", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv11111");
      linkInvitation(user.id, "inv22222");

      markNotified(user.id, "inv11111", "2026-07-31T10:00:00.000Z");

      expect(notificationTargets("inv11111")[0].last_notified_at).toBe("2026-07-31T10:00:00.000Z");
      expect(notificationTargets("inv22222")[0].last_notified_at).toBeNull();
    });

    // Opting out and back in must not look like "you have already been told"
    // for every event the account holds.
    it("survives an unsubscribe and resubscribe without resetting", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv12345");
      markNotified(user.id, "inv12345", "2026-07-31T10:00:00.000Z");

      setNotificationsEnabled(user.id, false);
      setNotificationsEnabled(user.id, true);

      expect(lastNotifiedAt(user.id, "inv12345")).toBe("2026-07-31T10:00:00.000Z");
    });

    it("leaves a disabled host disabled", () => {
      const { user } = signIn();
      setNotificationsEnabled(user.id, false);
      markNotified(user.id, "inv12345");
      expect(notificationTargets("inv12345")).toEqual([]);
    });
  });

  describe("unsubscribe by token", () => {
    // What a mail client's unsubscribe button promises: the sender stops, not
    // one message. Honouring it for a single event is what earns the second
    // click on "Spam" — and that costs sender reputation for everything the
    // product sends, guests' share links included.
    it("stops every invitation the account holds, not just one", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv11111");
      linkInvitation(user.id, "inv22222");
      const pref = ensurePref(user.id);

      expect(disableByUnsubToken(pref.unsub_token)).toBe(true);
      expect(notificationTargets("inv11111")).toEqual([]);
      expect(notificationTargets("inv22222")).toEqual([]);
    });

    it("stops only the account the token names", () => {
      const first = signIn("google-sub-1");
      const second = signIn("google-sub-2");
      linkInvitation(first.user.id, "inv12345");
      linkInvitation(second.user.id, "inv12345");

      disableByUnsubToken(ensurePref(first.user.id).unsub_token);

      const left = notificationTargets("inv12345");
      expect(left).toHaveLength(1);
      expect(left[0].user_id).toBe(second.user.id);
    });

    it("reports an unknown token without changing anything", () => {
      const { user } = signIn();
      linkInvitation(user.id, "inv12345");

      expect(disableByUnsubToken("not-a-real-token")).toBe(false);
      expect(notificationTargets("inv12345")).toHaveLength(1);
    });

    // The token is the whole credential for one action (§7). It must not be a
    // way into anything the manage token guards.
    it("leaves the keyring and the published record alone", async () => {
      const { user, cookies } = signIn();
      const published = await publish("Мій день народження", cookies);
      const pref = ensurePref(user.id);

      disableByUnsubToken(pref.unsub_token);

      const keyring = await app.inject({ method: "GET", url: "/api/account/keyring", cookies });
      expect(keyring.json().invitations.map((e: { id: string }) => e.id)).toEqual([published.id]);
      const guest = await app.inject({ method: "GET", url: `/api/invitations/${published.id}` });
      expect(guest.statusCode).toBe(200);
    });
  });

  // FR-11.4 lets a second signed-in account republish and link the same
  // invitation. adr-015's consequences leave that working rather than blocking
  // it, so the rows have to be independent.
  describe("two hosts holding one invitation", () => {
    it("notifies both and lets each unsubscribe alone", () => {
      const first = signIn("google-sub-1");
      const second = signIn("google-sub-2");
      linkInvitation(first.user.id, "inv12345");
      linkInvitation(second.user.id, "inv12345");

      expect(notificationTargets("inv12345")).toHaveLength(2);

      setNotificationsEnabled(first.user.id, false);
      const left = notificationTargets("inv12345");
      expect(left).toHaveLength(1);
      expect(left[0].user_id).toBe(second.user.id);
    });
  });

  // adr-014 §9 / FR-11.7, re-checked for the table this PR adds: deletion
  // takes the account's rows and nothing of the event's.
  describe("account deletion", () => {
    it("drops the preference rows by cascade", () => {
      const { user } = signIn();
      ensurePref(user.id);

      deleteUser(user.id);

      const rows = getDb().prepare("SELECT COUNT(*) AS n FROM notification_prefs").get() as {
        n: number;
      };
      expect(rows.n).toBe(0);
    });

    it("keeps the invitation and its RSVPs after the account goes", async () => {
      const { user, cookies } = signIn();
      const published = await publish("Мій день народження", cookies);
      ensurePref(user.id);
      await app.inject({
        method: "POST",
        url: `/api/invitations/${published.id}/rsvp`,
        payload: { name: "Іван", attending: true, party_size: 2 },
      });

      const deleted = await app.inject({ method: "DELETE", url: "/api/account", cookies });
      expect(deleted.statusCode).toBe(200);

      const guest = await app.inject({ method: "GET", url: `/api/invitations/${published.id}` });
      expect(guest.statusCode).toBe(200);
      const rsvps = await app.inject({
        method: "GET",
        url: `/api/invitations/${published.id}/rsvps`,
        headers: { "x-manage-token": published.manage_token },
      });
      expect(rsvps.json().rsvps).toHaveLength(1);
      // No account, so no keyring row, so nobody to notify — the invitation
      // keeps working and simply stops being a notification source.
      expect(notificationTargets(published.id)).toEqual([]);
    });
  });
});
