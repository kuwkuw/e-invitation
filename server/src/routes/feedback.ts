// Host feedback (adr-016): the one channel that runs from a host to us.
//
// Two endpoints with two different audiences and two different credentials.
// The write is open — no session required, because the hosts most worth
// hearing from are the ones who bounced at the publish gate (§2) — and the
// read is an operator's, gated by an env-var token and invisible without one.

import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { currentUser, originAllowed } from "../auth/session.js";
import { addFeedback, listFeedback } from "../feedback.js";
import { consumeIpAllowance } from "../guardrails.js";
import { FeedbackRequest } from "../schemas.js";

/** The operator credential, or null when none is configured. */
function feedbackToken(): string | null {
  const token = process.env.FEEDBACK_TOKEN;
  return token && token.length > 0 ? token : null;
}

/** Constant-time, and length-checked first because `timingSafeEqual` throws on
 *  a length mismatch — the same shape as `tokenMatches` in store.ts. */
function tokenAccepted(request: FastifyRequest, expected: string): boolean {
  const header = request.headers["x-feedback-token"];
  const provided = typeof header === "string" ? header : "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerFeedbackRoutes(app: FastifyInstance): void {
  app.post("/api/feedback", async (request, reply) => {
    // The submission itself is anonymous-capable, so CSRF against *the write*
    // is meaningless — anyone can post here directly. What the check protects
    // is the **attribution**: without it a cross-site form could file a
    // message against a signed-in host's account and put words in their name.
    // SameSite=Lax already withholds the cookie from a cross-site POST; this
    // is adr-014 §4's belt to that braces.
    if (!originAllowed(request)) return reply.code(403).send({ error: "Cross-origin request." });

    let body: FeedbackRequest;
    try {
      body = FeedbackRequest.parse(request.body);
    } catch {
      return reply.code(400).send({ error: "Expected { message, page, lang }." });
    }

    // Consumed on admission, like every other allowance (adr-008), so a host
    // who sends five messages cannot send a sixth by making each one fail
    // validation. Nothing here is exempt: there is no BYOK equivalent for a
    // suggestion box.
    if (!consumeIpAllowance(request.ip, "feedback")) {
      return reply
        .code(429)
        .send({ error: "Thanks — that's enough for today. Write again tomorrow." });
    }

    // Attributed when there is a session, anonymous when there is not, and
    // never asked for either way (§2). A host who is signed in was told on the
    // form that we can write back; a host who is not was told that we cannot.
    const user = currentUser(request);
    const stored = addFeedback({
      message: body.message,
      page: body.page,
      lang: body.lang,
      userId: user?.id ?? null,
    });

    // Metadata only — never `message` (§7). The body lives in the table and
    // nowhere else, so one DELETE removes it; a log line would be a second
    // copy with a different retention and a different access path. `length` is
    // enough to tell a real sentence from a stray keypress when reading logs.
    request.log.info({
      event: "feedback",
      id: stored.id,
      page: stored.page,
      lang: stored.lang,
      attributed: stored.user_id !== null,
      length: stored.message.length,
    });

    return { ok: true };
  });

  // The operator's read (§6). No admin UI and no pagination controls: an
  // operator with curl and the token has everything, and building a screen for
  // an audience of one is the failure mode this iteration is answerable to.
  app.get("/api/feedback", async (request, reply) => {
    const expected = feedbackToken();
    // Unconfigured answers **404, not 401 or 503**: a deployment that never
    // set up a reader should not advertise that a reader exists. That is the
    // keyless-boot convention (NFR-3, adr-014 §7, adr-015 §8) pointed in the
    // one direction that also costs an attacker information.
    if (!expected) return reply.code(404).send({ error: "Not found." });
    if (!tokenAccepted(request, expected)) return reply.code(403).send({ error: "Forbidden." });

    // Prose written by hosts, with addresses joined onto it — nothing between
    // this process and the operator should retain it (the adr-012 §1 rule).
    reply.header("Cache-Control", "no-store");
    return listFeedback();
  });
}
