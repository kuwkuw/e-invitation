import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, deleteUser, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { listFeedback } from "../src/feedback.js";
import { resetGuardrails } from "../src/guardrails.js";

/**
 * Host feedback (adr-017).
 *
 * The properties worth holding are not "a row is written". They are the four
 * decisions that would be quietly reversible without a test: sending needs no
 * account (§2), the row can never name an invitation (§3), the read endpoint
 * is invisible without an operator token (§6), and deleting an account
 * detaches feedback rather than destroying it (§8).
 */

let app: FastifyInstance;
let dataDir: string;

const OPERATOR_TOKEN = "operator-token-for-tests";

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-feedback-test-"));
  process.env.DATA_DIR = dataDir;
  resetGuardrails();
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

function send(
  payload: Record<string, unknown>,
  cookies?: Record<string, string>,
  headers?: Record<string, string>,
) {
  return app.inject({
    method: "POST",
    url: "/api/feedback",
    payload,
    ...(cookies ? { cookies } : {}),
    ...(headers ? { headers } : {}),
  });
}

function read(token = OPERATOR_TOKEN) {
  return app.inject({
    method: "GET",
    url: "/api/feedback",
    headers: { "x-feedback-token": token },
  });
}

const MESSAGE = { message: "The date field never understood 'next Saturday'.", page: "landing" };

describe("sending feedback", () => {
  // The whole point of §2. A form that required an account would collect
  // answers only from hosts who already got past the publish gate, which is
  // the one thing this channel exists to hear about.
  it("accepts a message with no session at all", async () => {
    const res = await send({ ...MESSAGE, lang: "en" });

    expect(res.statusCode).toBe(200);
    const stored = listFeedback();
    expect(stored.total).toBe(1);
    expect(stored.items[0].message).toBe(MESSAGE.message);
    expect(stored.items[0].email).toBeNull();
  });

  it("attributes a message sent with a session, joining the address at read time", async () => {
    const { cookies } = signIn();

    await send({ ...MESSAGE, lang: "uk", page: "manage" }, cookies);

    const stored = listFeedback();
    expect(stored.items[0].email).toBe("google-sub-1@example.com");
    expect(stored.items[0].page).toBe("manage");
    expect(stored.items[0].lang).toBe("uk");
  });

  it("returns newest first", async () => {
    await send({ message: "first", page: "landing", lang: "en" });
    await send({ message: "second", page: "landing", lang: "en" });

    // Both rows land inside the same millisecond on a fast machine, so this
    // asserts the set rather than the order — the ORDER BY is exercised by the
    // query running at all, and a flaky ordering assertion would be worse than
    // none.
    const stored = listFeedback();
    expect(stored.items.map((i) => i.message).sort()).toEqual(["first", "second"]);
  });

  describe("what a message may say about where it came from", () => {
    // adr-017 §3, and the reason `page` is an enum rather than a URL: an
    // invitation id would rebuild the host graph adr-012 §3 and adr-005 both
    // refused, arriving attached to free text.
    it("refuses a page outside the closed enum", async () => {
      expect((await send({ message: "hi", page: "/i/abc123xy", lang: "en" })).statusCode).toBe(400);
      expect((await send({ message: "hi", page: "editor", lang: "en" })).statusCode).toBe(400);
      expect(listFeedback().total).toBe(0);
    });

    it("stores no column that could carry one", () => {
      // A structural assertion rather than a behavioural one: the guard is the
      // absence of a place to put it, so the schema is what has to be held.
      const columns = Object.keys(
        (listFeedback().items[0] ?? {
          id: "",
          message: "",
          page: "",
          lang: "",
          email: null,
          created_at: "",
        }) as Record<string, unknown>,
      );
      expect(columns).not.toContain("invitation_id");
      expect(columns).not.toContain("ip");
      expect(columns).not.toContain("url");
    });
  });

  describe("validation", () => {
    it("rejects an empty or whitespace-only message", async () => {
      expect((await send({ message: "", page: "landing", lang: "en" })).statusCode).toBe(400);
      expect((await send({ message: "   ", page: "landing", lang: "en" })).statusCode).toBe(400);
      expect(listFeedback().total).toBe(0);
    });

    it("rejects a message over the cap", async () => {
      const res = await send({ message: "x".repeat(2001), page: "landing", lang: "en" });
      expect(res.statusCode).toBe(400);
    });

    it("rejects an unknown language", async () => {
      expect((await send({ message: "hi", page: "landing", lang: "fr" })).statusCode).toBe(400);
    });

    // adr-014 §4's belt to SameSite=Lax's braces. The write is open, so this
    // protects the *attribution* rather than the write: without it a
    // cross-site form could file a message against a signed-in host's account.
    it("refuses a cross-origin submission", async () => {
      const { cookies } = signIn();

      const res = await send({ ...MESSAGE, lang: "en" }, cookies, {
        origin: "https://evil.example",
        host: "localhost:3001",
      });

      expect(res.statusCode).toBe(403);
      expect(listFeedback().total).toBe(0);
    });
  });

  describe("the daily allowance (§5)", () => {
    it("stops at the limit and says so with a 429", async () => {
      vi.stubEnv("LIMIT_FEEDBACK_PER_DAY", "2");

      expect((await send({ message: "one", page: "landing", lang: "en" })).statusCode).toBe(200);
      expect((await send({ message: "two", page: "landing", lang: "en" })).statusCode).toBe(200);
      expect((await send({ message: "three", page: "landing", lang: "en" })).statusCode).toBe(429);
      expect(listFeedback().total).toBe(2);
    });

    // Consumed on admission, like every other allowance (adr-008): otherwise a
    // sender could spend the day's budget on malformed bodies and keep going.
    it("is not spent by a request that fails validation", async () => {
      vi.stubEnv("LIMIT_FEEDBACK_PER_DAY", "1");

      expect((await send({ message: "", page: "landing", lang: "en" })).statusCode).toBe(400);
      expect((await send({ message: "real", page: "landing", lang: "en" })).statusCode).toBe(200);
    });

    it("0 disables it", async () => {
      vi.stubEnv("LIMIT_FEEDBACK_PER_DAY", "0");
      for (let i = 0; i < 12; i++) {
        expect((await send({ message: `m${i}`, page: "landing", lang: "en" })).statusCode).toBe(
          200,
        );
      }
    });
  });
});

describe("the operator's read (§6)", () => {
  it("answers 404 when no reader is configured — not 401, not 503", async () => {
    await send({ ...MESSAGE, lang: "en" });

    const res = await read();

    // A deployment that never set up a reader must not advertise that a reader
    // exists, which is the one direction of the keyless-boot convention that
    // also costs an attacker information.
    expect(res.statusCode).toBe(404);
  });

  it("refuses a wrong token", async () => {
    vi.stubEnv("FEEDBACK_TOKEN", OPERATOR_TOKEN);
    await send({ ...MESSAGE, lang: "en" });

    expect((await read("not-the-token")).statusCode).toBe(403);
    // Same length as the real one: the comparison is constant-time, and a
    // length-only check would pass this.
    expect((await read("x".repeat(OPERATOR_TOKEN.length))).statusCode).toBe(403);
  });

  it("refuses a missing token", async () => {
    vi.stubEnv("FEEDBACK_TOKEN", OPERATOR_TOKEN);

    const res = await app.inject({ method: "GET", url: "/api/feedback" });

    expect(res.statusCode).toBe(403);
  });

  it("returns the messages with the token, and never caches them", async () => {
    vi.stubEnv("FEEDBACK_TOKEN", OPERATOR_TOKEN);
    const { cookies } = signIn();
    await send({ ...MESSAGE, lang: "en" }, cookies);

    const res = await read();

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].message).toBe(MESSAGE.message);
    expect(body.items[0].email).toBe("google-sub-1@example.com");
  });
});

// adr-017 §8, extending adr-014 §9's rule that deleting an account removes the
// account and not the work. Feedback is the third case: the message is about
// the product and the identity is incidental to it, so the row survives
// without a name on it. Erasing it would throw away the only signal this
// feature collects; keeping the name would ignore what the host just asked
// for.
describe("account deletion", () => {
  it("detaches feedback rather than deleting it", async () => {
    vi.stubEnv("FEEDBACK_TOKEN", OPERATOR_TOKEN);
    const { user, cookies } = signIn();
    await send({ ...MESSAGE, lang: "en" }, cookies);
    expect(listFeedback().items[0].email).toBe("google-sub-1@example.com");

    deleteUser(user.id);

    const stored = listFeedback();
    expect(stored.total).toBe(1);
    expect(stored.items[0].message).toBe(MESSAGE.message);
    expect(stored.items[0].email).toBeNull();
  });

  it("survives deletion through the endpoint the host actually presses", async () => {
    const { cookies } = signIn();
    await send({ ...MESSAGE, lang: "en" }, cookies);

    const res = await app.inject({ method: "DELETE", url: "/api/account", cookies });

    expect(res.statusCode).toBe(200);
    expect(listFeedback().total).toBe(1);
    expect(listFeedback().items[0].email).toBeNull();
  });
});

describe("/healthz", () => {
  it("reports the feedback allowance beside the others", async () => {
    vi.stubEnv("LIMIT_FEEDBACK_PER_DAY", "7");

    const res = await app.inject({ method: "GET", url: "/healthz" });

    expect(res.json().guardrails.limits.feedback_per_ip_per_day).toBe(7);
  });
});
