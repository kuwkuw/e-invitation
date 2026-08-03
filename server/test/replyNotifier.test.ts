import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { notifyNewReplies } from "../src/email/replyNotifier.js";
import { getPref, lastNotifiedAt, setNotificationsEnabled } from "../src/notifications.js";
import type { Invitation } from "../src/schemas.js";
import { addRsvp, getRecord, type PublishedRecord } from "../src/store.js";

const BASE = "https://invinto.app";

function invitation(title: string, language: "uk" | "en" = "uk"): Invitation {
  return {
    brief: {
      event_type: "birthday",
      hosts: ["Олена"],
      date: "12 серпня",
      time: "18:00",
      venue: "Кафе «Затишок»",
      city: "Львів",
      tone: "warm and familial",
      language,
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
  dataDir = mkdtempSync(join(tmpdir(), "inv-notify-test-"));
  process.env.DATA_DIR = dataDir;
  app = await buildApp({ logger: false });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await app.close();
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

function configureMail() {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("NOTIFY_FROM", "HOSTYMO <replies@invinto.app>");
}

function stubSend(response = new Response(JSON.stringify({ id: "msg-1" }))) {
  const spy = vi.fn(async () => response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function sentBodies(spy: ReturnType<typeof vi.fn>): Record<string, any>[] {
  return spy.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

function signIn(googleSub = "google-sub-1") {
  const user = upsertUser(googleSub, `${googleSub}@example.com`);
  return { user, cookies: { inv_session: createSession(user.id).id } };
}

/** A signed-in host who has asked for reply email (adr-015 §7, amended).
 *
 *  Opt-in itself is asserted in `notifications.test.ts`, where eligibility is
 *  decided. Here it is setup: these cases are about the rate limit, the message
 *  and the failure path, and spelling the opt-in out in each one would bury
 *  what they actually check. The cases that expect *no* mail use plain
 *  `signIn`, so the difference stays visible where it matters. */
function signInWantingMail(googleSub = "google-sub-1") {
  const session = signIn(googleSub);
  setNotificationsEnabled(session.user.id, true);
  return session;
}

async function publish(
  inv: Invitation,
  cookies?: Record<string, string>,
): Promise<PublishedRecord> {
  const res = await app.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload: { invitation: inv },
    ...(cookies ? { cookies } : {}),
  });
  const record = getRecord(res.json().id);
  if (!record) throw new Error("publish did not create a record");
  return record;
}

/** A reply straight into the store, so a test controls its timestamp.
 *
 *  Returns the updated record: `addRsvp` is immutable, so the reply exists
 *  only in what it hands back. Threading it is what the route has to do too. */
function reply(record: PublishedRecord, name: string, createdAt: string): PublishedRecord {
  return addRsvp(record, {
    name,
    attending: true,
    guests_count: 1,
    note: null,
    created_at: createdAt,
  });
}

describe("reply notifications", () => {
  describe("when there is nobody to notify", () => {
    it("sends nothing for an anonymously published invitation", async () => {
      configureMail();
      const spy = stubSend();
      let record = await publish(invitation("Анонімне"));
      record = reply(record, "Іван", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      expect(spy).not.toHaveBeenCalled();
    });

    // §8: no credentials is a supported mode, and it costs nothing per RSVP.
    it("does no work at all when mail is unconfigured", async () => {
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      expect(spy).not.toHaveBeenCalled();
    });

    // adr-015 §7 as amended: publishing while signed in is not asking for
    // mail. Distinct from the case below it — this host never chose, that one
    // chose and changed their mind — and both must be silent.
    it("sends nothing to a host who never asked for mail", async () => {
      configureMail();
      const spy = stubSend();
      const { cookies } = signIn();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      expect(spy).not.toHaveBeenCalled();
    });

    it("sends nothing to a host who turned notifications off", async () => {
      configureMail();
      const spy = stubSend();
      const { user, cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      setNotificationsEnabled(user.id, false);
      record = reply(record, "Іван", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      expect(spy).not.toHaveBeenCalled();
    });

    it("sends nothing when there are no replies yet", async () => {
      configureMail();
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      const record = await publish(invitation("Мій день"), cookies);

      await notifyNewReplies(record, BASE);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("the rate limit", () => {
    it("mails the first reply immediately, counting every live reply", async () => {
      configureMail();
      const spy = stubSend();
      const { user, cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", "2026-07-31T10:00:00.000Z");
      record = reply(record, "Олег", "2026-07-31T10:01:00.000Z");

      await notifyNewReplies(record, BASE);

      expect(spy).toHaveBeenCalledTimes(1);
      // A host who has never been told gets every reply counted — all of them
      // are news. countNewSince returns 0 without a baseline, which is right
      // for the dashboard and wrong for a first email.
      expect(sentBodies(spy)[0].subject).toBe("2 нові відповіді — Мій день");
      expect(lastNotifiedAt(user.id, record.id)).not.toBeNull();
    });

    it("stays silent for a reply inside the window", async () => {
      configureMail();
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());
      await notifyNewReplies(record, BASE);

      record = reply(record, "Олег", new Date().toISOString());
      await notifyNewReplies(record, BASE);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("mails again after the window, counting only what is new", async () => {
      configureMail();
      const spy = stubSend();
      const { user, cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", "2026-07-31T09:00:00.000Z");
      await notifyNewReplies(record, BASE);

      // Push the baseline back beyond the window rather than waiting an hour.
      const stamped = new Date(Date.now() - 90 * 60_000).toISOString();
      setNotificationsEnabled(user.id, true);
      const { markNotified } = await import("../src/notifications.js");
      markNotified(user.id, record.id, stamped);

      record = reply(record, "Олег", new Date().toISOString());
      record = reply(record, "Марія", new Date().toISOString());
      await notifyNewReplies(record, BASE);

      expect(spy).toHaveBeenCalledTimes(2);
      // Two new since the stamp — Іван is older than it and is not re-counted.
      expect(sentBodies(spy)[1].subject).toBe("2 нові відповіді — Мій день");
    });

    it("honours a zero window as notify-on-every-reply", async () => {
      configureMail();
      vi.stubEnv("NOTIFY_WINDOW_MINUTES", "0");
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);

      record = reply(record, "Іван", new Date(Date.now() - 1000).toISOString());
      await notifyNewReplies(record, BASE);
      record = reply(record, "Олег", new Date().toISOString());
      await notifyNewReplies(record, BASE);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("falls back to the default rather than disabling on a malformed window", async () => {
      configureMail();
      vi.stubEnv("NOTIFY_WINDOW_MINUTES", "not-a-number");
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());
      await notifyNewReplies(record, BASE);
      record = reply(record, "Олег", new Date().toISOString());
      await notifyNewReplies(record, BASE);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("the message", () => {
    it("links to a bare manage URL and an unsubscribe token", async () => {
      configureMail();
      const spy = stubSend();
      const { user, cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      const body = sentBodies(spy)[0];
      const token = getPref(user.id)?.unsub_token;
      expect(body.text).toContain(`${BASE}/manage/${record.id}`);
      expect(body.text).not.toContain("#t=");
      expect(body.text).toContain(`${BASE}/unsubscribe/${token}`);
      expect(body.headers["List-Unsubscribe"]).toBe(`<${BASE}/unsubscribe/${token}>`);
    });

    // §3, checked end to end: the guest's name reaches the store and not the
    // provider.
    it("names no guest, though the reply is in the record", async () => {
      configureMail();
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван Петренко", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      const body = sentBodies(spy)[0];
      expect(JSON.stringify(body)).not.toContain("Іван Петренко");
      expect(record.rsvps[0].name).toBe("Іван Петренко");
    });

    it("writes in the invitation's language", async () => {
      configureMail();
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("My birthday", "en"), cookies);
      record = reply(record, "Ivan", new Date().toISOString());

      await notifyNewReplies(record, BASE);

      expect(sentBodies(spy)[0].subject).toBe("1 new reply — My birthday");
    });
  });

  describe("failure", () => {
    // §5: a failed send must not consume the window, so the next reply tries
    // again rather than the host losing an hour of notifications.
    it("leaves the baseline unstamped so the next reply retries", async () => {
      configureMail();
      const spy = stubSend(new Response("nope", { status: 500 }));
      const { user, cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());

      await notifyNewReplies(record, BASE);
      expect(lastNotifiedAt(user.id, record.id)).toBeNull();

      spy.mockResolvedValue(new Response(JSON.stringify({ id: "msg-2" })));
      record = reply(record, "Олег", new Date().toISOString());
      await notifyNewReplies(record, BASE);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(lastNotifiedAt(user.id, record.id)).not.toBeNull();
    });

    it("never rejects, whatever the transport does", async () => {
      configureMail();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("ENOTFOUND");
        }),
      );
      const { cookies } = signInWantingMail();
      let record = await publish(invitation("Мій день"), cookies);
      record = reply(record, "Іван", new Date().toISOString());

      await expect(notifyNewReplies(record, BASE)).resolves.toBeUndefined();
    });
  });

  // FR-11.4 allows a second account to hold the same invitation.
  it("notifies both holders independently", async () => {
    configureMail();
    const spy = stubSend();
    const first = signInWantingMail("google-sub-1");
    const second = signInWantingMail("google-sub-2");
    let record = await publish(invitation("Мій день"), first.cookies);
    const { linkInvitation } = await import("../src/accounts.js");
    linkInvitation(second.user.id, record.id);
    record = reply(record, "Іван", new Date().toISOString());

    await notifyNewReplies(record, BASE);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(
      sentBodies(spy)
        .map((b) => b.to[0])
        .sort(),
    ).toEqual(["google-sub-1@example.com", "google-sub-2@example.com"]);
  });

  // §5 at the route boundary: the guest's answer is what must survive.
  describe("the RSVP endpoint", () => {
    it("answers ok and stores the reply even when sending fails", async () => {
      configureMail();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("ENOTFOUND");
        }),
      );
      const { cookies } = signInWantingMail();
      const record = await publish(invitation("Мій день"), cookies);

      const res = await app.inject({
        method: "POST",
        url: `/api/invitations/${record.id}/rsvp`,
        payload: { name: "Іван", attending: true, party_size: 2 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(getRecord(record.id)?.rsvps).toHaveLength(1);
    });

    // Regression: `addRsvp` is immutable, and notifying from the pre-reply
    // record counted every reply except the one being notified about — which
    // for a first reply is zero, so the first email never went out. Only a
    // test through the real route catches it; the notifier is correct either
    // way, it was the caller that was wrong.
    it("counts the reply that just arrived", async () => {
      configureMail();
      const spy = stubSend();
      const { cookies } = signInWantingMail();
      const record = await publish(invitation("Мій день"), cookies);

      await app.inject({
        method: "POST",
        url: `/api/invitations/${record.id}/rsvp`,
        payload: { name: "Іван", attending: true, party_size: 2 },
      });
      // The dispatch is deliberately not awaited by the handler (§5), so let
      // the floating promise settle before asserting on it.
      await new Promise((resolve) => setImmediate(resolve));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(sentBodies(spy)[0].subject).toBe("1 нова відповідь — Мій день");
    });
  });
});
