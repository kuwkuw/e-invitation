// Google sign-in (adr-014 §3, §4). Four routes, all under /api so the session
// cookie's Path scope covers them and nothing else.
//
// This PR wires the flow and nothing more: signing in creates an account and a
// session, and changes no other behaviour. The keyring endpoint (§5) and the
// publish gate (§2) come next.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createSession, deleteSession, upsertUser } from "../accounts.js";
import {
  AuthError,
  type AuthFailureCode,
  authorizeUrl,
  exchangeCode,
  googleConfig,
  publishRequiresAccount,
  verifyIdToken,
} from "../auth/google.js";
import {
  clearSessionCookie,
  currentUser,
  originAllowed,
  SESSION_COOKIE,
  setSessionCookie,
} from "../auth/session.js";
import {
  browserKeyMatches,
  consumeOauthState,
  createOauthState,
  newBrowserKey,
} from "../auth/state.js";
import { emailConfigured } from "../email/send.js";

const DEFAULT_REDIRECT_TO = "/create";
const CALLBACK_PATH = "/api/auth/google/callback";

// Binds an in-flight sign-in to the browser that started it (adr-014 §3). The
// state row holds only this value's hash, and the callback refuses anything it
// cannot match — see auth/state.ts for the attack that single-use state does
// not cover.
const OAUTH_COOKIE = "inv_oauth";
// The state row's own TTL. A binding that outlived the row it points at would
// prove nothing, and an abandoned sign-in should not leave a cookie behind.
const OAUTH_COOKIE_MAX_AGE_S = 10 * 60;

/** `Path=/api/auth` so this rides the callback and no other request — the
 *  narrower form of the reasoning that puts the session cookie on `/api`
 *  (§4). `SameSite=Lax` still permits the top-level GET navigation Google's
 *  redirect back is, which is the only request that needs it. */
function oauthCookieOptions(request: FastifyRequest) {
  return {
    httpOnly: true,
    secure: request.protocol === "https",
    sameSite: "lax" as const,
    path: "/api/auth",
  };
}

export function registerAuthRoutes(app: FastifyInstance): void {
  // Start the flow. 503 rather than 404 when OAuth is unconfigured (§7): the
  // route exists, the deployment simply has no identity provider, and the
  // client asks /api/auth/session which surface to show before ever coming
  // here.
  app.get("/api/auth/google", async (request, reply) => {
    const config = googleConfig();
    if (!config) return reply.code(503).send({ error: "Sign-in is not configured." });

    const query = request.query as { redirect_to?: string };
    // Minted before the row so the row can store its hash. A second sign-in
    // started in the same browser overwrites this, and the older tab's callback
    // then fails as "state" — the correct answer for a flow that browser has
    // moved on from.
    const browserKey = newBrowserKey();
    const state = createOauthState({
      redirectUri: callbackUri(request, config.redirectUri),
      redirectTo: safeRedirectPath(query.redirect_to),
      browserKey,
    });
    reply.setCookie(OAUTH_COOKIE, browserKey, {
      ...oauthCookieOptions(request),
      maxAge: OAUTH_COOKIE_MAX_AGE_S,
    });
    return reply.redirect(
      authorizeUrl(config, {
        state: state.state,
        nonce: state.nonce,
        codeChallenge: state.code_challenge,
        redirectUri: state.redirect_uri,
      }),
      302,
    );
  });

  // Google sends the browser back here. Every failure lands the host back in
  // the app with a marker rather than on a JSON error page — they are
  // mid-task, and a dead end here is a lost publish.
  app.get(CALLBACK_PATH, async (request, reply) => {
    const config = googleConfig();
    if (!config) return reply.code(503).send({ error: "Sign-in is not configured." });

    const query = request.query as { code?: string; state?: string; error?: string };
    // Read before anything can return, and cleared on every path: this flow is
    // over either way, and a binding left behind only survives to confuse the
    // next attempt.
    const browserKey = request.cookies?.[OAUTH_COOKIE];
    reply.clearCookie(OAUTH_COOKIE, oauthCookieOptions(request));

    // The host pressed "cancel" on Google's screen. Not an error, and it must
    // not read like one — including in where it leaves them.
    if (query.error) {
      return reply.redirect(withAuthResult(declinedReturn(query.state), "declined"), 302);
    }
    if (!query.code || !query.state) {
      return reply.redirect(withAuthResult(DEFAULT_REDIRECT_TO, "failed", "state"), 302);
    }

    // Single-use: reading it deletes it, so a replayed callback finds nothing.
    const pending = consumeOauthState(query.state);
    // Consumed *before* the binding is checked, so a callback opened in the
    // wrong browser burns the state rather than leaving it for whoever planted
    // it to finish afterwards. Unknown state and wrong browser answer alike:
    // both mean this browser did not start this sign-in, and telling them apart
    // would only tell an attacker which half they got right.
    if (!pending || !browserKeyMatches(pending, browserKey)) {
      return reply.redirect(withAuthResult(DEFAULT_REDIRECT_TO, "failed", "state"), 302);
    }

    try {
      const idToken = await exchangeCode(config, {
        code: query.code,
        codeVerifier: pending.code_verifier,
        redirectUri: pending.redirect_uri,
      });
      const identity = await verifyIdToken(config, idToken, pending.nonce);
      const user = upsertUser(identity.sub, identity.email);
      setSessionCookie(request, reply, createSession(user.id).id);
      return reply.redirect(withAuthResult(pending.redirect_to, "ok"), 302);
    } catch (error) {
      // Which part of the handshake broke is a log detail, never a response —
      // the same rule the gateway applies to raw provider messages.
      request.log.error({ err: error, byok: false }, "google sign-in failed");
      if (!(error instanceof AuthError)) throw error;
      return reply.redirect(withAuthResult(pending.redirect_to, "failed", error.code), 302);
    }
  });

  // What the client asks to decide whether to show a sign-in affordance. Also
  // the only place it learns the address on file, which the httpOnly cookie
  // deliberately cannot tell it.
  app.get("/api/auth/session", async (request, reply) => {
    // Per-account data behind a credential — the adr-012 §1 rule.
    reply.header("Cache-Control", "no-store");
    const user = currentUser(request);
    return {
      configured: googleConfig() !== null,
      // Whether a first publish will be refused (§2). The client needs this
      // *before* the host presses Publish: the gate mounts on the press, not
      // on a 401, so the sheet is the first frame of the share panel rather
      // than a screen that appears after a failed request.
      publish_gate: publishRequiresAccount(),
      // Whether this deployment can send reply notifications at all (adr-015
      // §8). It rides the session probe for the same reason `publish_gate`
      // does: this endpoint is the client's one question about what the
      // deployment can do for a host, and the share panel has to know
      // synchronously — a promise of email that a mail-less deployment will
      // never keep is worse than no line at all.
      notifications: emailConfigured(),
      signed_in: user !== null,
      email: user?.email ?? null,
    };
  });

  // POST, not GET: this is a state change, and a GET sign-out is a link an
  // image tag can fire. One of the two cookie-authorized mutations in the app
  // (§4), so it gets the origin check.
  app.post("/api/auth/signout", async (request, reply) => {
    if (!originAllowed(request)) return reply.code(403).send({ error: "Cross-origin request." });
    const id = request.cookies?.[SESSION_COOKIE];
    if (id) deleteSession(id);
    clearSessionCookie(request, reply);
    return reply.code(204).send();
  });
}

/** The exact URI Google redirects back to. `GOOGLE_REDIRECT_URI` wins when
 *  set, because Google matches it against a registered allowlist and a
 *  deployment behind CANONICAL_HOST must send the canonical one. Deriving it
 *  from the request is what makes localhost work with no second registration;
 *  a forged Host header only produces a URI Google refuses. */
function callbackUri(request: FastifyRequest, configured: string | null): string {
  return configured ?? `${request.protocol}://${request.headers.host}${CALLBACK_PATH}`;
}

/** What a same-origin path may be spelled with. An **allowlist**, because the
 *  list of tricks is not knowable: `//evil.example` and `/\evil.example` are
 *  protocol-relative in browsers that normalize them, and a raw tab or newline
 *  is stripped from a URL *before* it is parsed — so `/⇥/evil.example` arrives
 *  at `//evil.example` through any guard that only knows about slashes. */
const SAFE_REDIRECT_PATH = /^\/[\w\-./~]*$/;

/** An open-redirect guard, not a formality: `redirect_to` comes off the query
 *  string and ends up in a `Location` header. Only same-origin absolute paths
 *  survive, and `//` is still refused explicitly — the class above has to allow
 *  the separator, so the leading pair is the one shape it cannot rule out. */
function safeRedirectPath(value: string | undefined): string {
  if (!value || !SAFE_REDIRECT_PATH.test(value)) return DEFAULT_REDIRECT_TO;
  if (value.startsWith("//")) return DEFAULT_REDIRECT_TO;
  return value;
}

/**
 * Where a declined sign-in lands the host: back where they pressed it.
 *
 * `/create` was right for as long as the publish gate was the only way in —
 * the host was already there. With a sign-in entry point on the landing page,
 * a host who changes their mind would be dropped into an editor they never
 * asked for, which reads as a product that ignored them.
 *
 * The row is consumed because the flow is over either way; an unknown or
 * absent state simply falls back. No browser-binding check, unlike the paths
 * below it: this decides a same-origin path that `safeRedirectPath` already
 * constrained at mint, grants nothing, and burning a state row here is
 * something anyone holding the state value can already do at the callback.
 */
function declinedReturn(state: string | undefined): string {
  if (!state) return DEFAULT_REDIRECT_TO;
  return consumeOauthState(state)?.redirect_to ?? DEFAULT_REDIRECT_TO;
}

/** The result rides a query parameter, which the client reads once and strips
 *  through the router (adr-011 §4), as it does `?ref`. Nothing secret is in
 *  it — the session is in the cookie.
 *
 *  A failure additionally carries the coarse class, which the gate renders as
 *  `auth_<code>_failed` for a host to read out to support. It is a class, never
 *  prose: which token was rejected and why stays in the log. */
function withAuthResult(
  path: string,
  result: "ok" | "failed" | "declined",
  code?: AuthFailureCode,
): string {
  const separator = path.includes("?") ? "&" : "?";
  const suffix = code ? `&auth_code=${code}` : "";
  return `${path}${separator}auth=${result}${suffix}`;
}

/** Exported for the routes that will gate on a session (§2, §5). Returns the
 *  user or sends the 401 itself, so a caller cannot forget the reply. */
export function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = currentUser(request);
  if (!user) {
    reply.code(401).send({ error: "Sign in to continue." });
    return null;
  }
  return user;
}
