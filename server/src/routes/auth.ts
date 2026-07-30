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
  authorizeUrl,
  exchangeCode,
  googleConfig,
  verifyIdToken,
} from "../auth/google.js";
import {
  clearSessionCookie,
  currentUser,
  originAllowed,
  SESSION_COOKIE,
  setSessionCookie,
} from "../auth/session.js";
import { consumeOauthState, createOauthState } from "../auth/state.js";

const DEFAULT_REDIRECT_TO = "/create";
const CALLBACK_PATH = "/api/auth/google/callback";

export function registerAuthRoutes(app: FastifyInstance): void {
  // Start the flow. 503 rather than 404 when OAuth is unconfigured (§7): the
  // route exists, the deployment simply has no identity provider, and the
  // client asks /api/auth/session which surface to show before ever coming
  // here.
  app.get("/api/auth/google", async (request, reply) => {
    const config = googleConfig();
    if (!config) return reply.code(503).send({ error: "Sign-in is not configured." });

    const query = request.query as { redirect_to?: string };
    const state = createOauthState({
      redirectUri: callbackUri(request, config.redirectUri),
      redirectTo: safeRedirectPath(query.redirect_to),
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
    // The host pressed "cancel" on Google's screen. Not an error, and it must
    // not read like one.
    if (query.error) return reply.redirect(withAuthResult(DEFAULT_REDIRECT_TO, "declined"), 302);
    if (!query.code || !query.state) {
      return reply.redirect(withAuthResult(DEFAULT_REDIRECT_TO, "failed"), 302);
    }

    // Single-use: reading it deletes it, so a replayed callback finds nothing.
    const pending = consumeOauthState(query.state);
    if (!pending) return reply.redirect(withAuthResult(DEFAULT_REDIRECT_TO, "failed"), 302);

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
      return reply.redirect(withAuthResult(pending.redirect_to, "failed"), 302);
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

/** An open-redirect guard, not a formality: `redirect_to` comes off the query
 *  string and ends up in a `Location` header. Only same-origin absolute paths
 *  survive — a protocol-relative `//evil.example` or a backslash variant is a
 *  full external redirect in browsers that normalize it. */
function safeRedirectPath(value: string | undefined): string {
  if (!value?.startsWith("/")) return DEFAULT_REDIRECT_TO;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_REDIRECT_TO;
  return value;
}

/** The result rides a query parameter, which the client reads once and strips
 *  through the router (adr-011 §4), as it does `?ref`. Nothing secret is in
 *  it — the session is in the cookie. */
function withAuthResult(path: string, result: "ok" | "failed" | "declined"): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}auth=${result}`;
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
