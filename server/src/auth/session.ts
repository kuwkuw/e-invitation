// The session cookie (adr-014 §4). An opaque id, looked up in SQLite — not a
// JWT, because there is a database now and a revocable session is worth more
// than a stateless one at this size. Nothing is signed: the value is 32 random
// bytes that mean nothing except as a row key, so there is no claim to forge.

import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession, getUser, type User } from "../accounts.js";

export const SESSION_COOKIE = "inv_session";
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

// Path=/api is deliberate and load-bearing: the cookie must never ride
// `GET /i/:id` or the OG image request. Those are crawler-visible, cacheable,
// server-rendered paths (FR-3.5), and adr-010 §2 already spent this project's
// care on keeping host credentials out of exactly that request path.
//
// SameSite=Lax is the CSRF control for the two cookie-authorized operations
// (§4): browsers withhold the cookie from cross-site POSTs, and `sameSiteNone`
// is never an option here. It still permits the top-level GET navigation that
// Google's callback redirect is, which is why sign-in works at all.
function cookieOptions(request: FastifyRequest) {
  return {
    httpOnly: true,
    // trustProxy is on, so this reads x-forwarded-proto behind the hosting
    // proxy. Off on plain-http localhost, or the browser drops the cookie and
    // development silently never signs in.
    secure: request.protocol === "https",
    sameSite: "lax" as const,
    path: "/api",
  };
}

export function setSessionCookie(request: FastifyRequest, reply: FastifyReply, id: string): void {
  reply.setCookie(SESSION_COOKIE, id, { ...cookieOptions(request), maxAge: SESSION_MAX_AGE_S });
}

export function clearSessionCookie(request: FastifyRequest, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, cookieOptions(request));
}

/** The signed-in account, or null. Every caller goes through this rather than
 *  reading the cookie, so "expired" and "revoked" are handled in one place —
 *  `getSession` already returns null for both. */
export function currentUser(request: FastifyRequest): User | null {
  const id = request.cookies?.[SESSION_COOKIE];
  if (!id) return null;
  const session = getSession(id);
  return session ? getUser(session.user_id) : null;
}

/** Belt to SameSite=Lax's braces on cookie-authorized mutations (§4). Lax
 *  already withholds the cookie from a cross-site POST; this refuses the
 *  request outright if a browser ever sends one anyway.
 *
 *  A missing Origin is allowed: non-browser callers (curl, the tests) send
 *  none, and they carry no ambient cookie for an attacker to ride. */
export function originAllowed(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}
