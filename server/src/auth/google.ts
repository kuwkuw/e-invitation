// Google OpenID Connect, authorization-code with PKCE, entirely server-side
// (adr-014 §3). No Google JavaScript SDK — the web bundle gains nothing, which
// matters under NFR-1's mobile-first budget — and no OAuth library: the flow is
// two fetches and a signature check, and Node's crypto verifies RS256 from a
// JWK natively.
//
// Scopes are `openid email` and nothing else (NFR-4, adr-014 §9). No profile
// photo, no name, no contacts.

import { createPublicKey, verify as verifySignature } from "node:crypto";

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
// Google's tokens are minted seconds before we see them; a little tolerance
// stops a clock a few seconds fast from rejecting every sign-in.
const CLOCK_SKEW_S = 60;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Explicit override. Unset means "derive from the incoming request", which
   *  is what makes localhost development work without a second registration. */
  redirectUri: string | null;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

/** Thrown for every failure in the flow. The message is for the log; callers
 *  map it to one generic user-facing failure, because "which part of the
 *  handshake broke" is not a guest-safe distinction — the same instinct that
 *  keeps the gateway's raw provider messages out of the 502 body. */
export class AuthError extends Error {}

/** null when the operator has not configured OAuth. adr-014 §7 makes that a
 *  supported mode, not an error: the server boots, publish stays anonymous,
 *  and local development needs no OAuth client — the same shape as NFR-3's
 *  keyless boot for LLM providers. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: process.env.GOOGLE_REDIRECT_URI ?? null };
}

/** Whether this deployment has an identity provider at all. Read on every
 *  request rather than cached at boot, so a test (and an operator restarting
 *  with new env) sees the current answer. It is also what decides whether the
 *  publish gate applies (adr-014 §2, §7): no OAuth client, no gate. */
export function signInAvailable(): boolean {
  return googleConfig() !== null;
}

export function authorizeUrl(
  config: GoogleConfig,
  params: { state: string; nonce: string; codeChallenge: string; redirectUri: string },
): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCode(
  config: GoogleConfig,
  params: { code: string; codeVerifier: string; redirectUri: string },
): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: params.code,
      code_verifier: params.codeVerifier,
      // Must repeat the value sent to the authorize endpoint byte-for-byte,
      // which is why the state row carries it rather than re-deriving here.
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new AuthError(`Token exchange failed with ${response.status}.`);
  }
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new AuthError("Token response carried no id_token.");
  return body.id_token;
}

/** Full verification against Google's JWKS, even though the token arrived
 *  straight from the token endpoint over TLS (which OIDC lets you treat as
 *  sufficient). It is ~30 lines with no dependency, and it keeps the check
 *  correct if the flow ever stops being a direct back-channel exchange. */
export async function verifyIdToken(
  config: GoogleConfig,
  idToken: string,
  expectedNonce: string,
): Promise<GoogleIdentity> {
  const [headerB64, payloadB64, signatureB64, extra] = idToken.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64 || extra !== undefined) {
    throw new AuthError("Malformed id_token.");
  }

  const header = decodeSegment(headerB64) as { kid?: string; alg?: string };
  if (header.alg !== "RS256") throw new AuthError(`Unexpected id_token alg ${header.alg}.`);
  if (!header.kid) throw new AuthError("id_token carried no kid.");

  const key = await signingKey(header.kid);
  const signed = Buffer.from(`${headerB64}.${payloadB64}`);
  const ok = verifySignature(
    "RSA-SHA256",
    signed,
    createPublicKey({ key: key as never, format: "jwk" }),
    Buffer.from(signatureB64, "base64url"),
  );
  if (!ok) throw new AuthError("id_token signature did not verify.");

  const claims = decodeSegment(payloadB64) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    nonce?: string;
    email?: string;
    email_verified?: boolean | string;
  };
  if (!claims.iss || !ISSUERS.has(claims.iss)) throw new AuthError("Unexpected id_token issuer.");
  if (claims.aud !== config.clientId)
    throw new AuthError("id_token was issued for another client.");
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_S < Date.now() / 1000) {
    throw new AuthError("id_token has expired.");
  }
  // The nonce is what ties this token to the sign-in *this browser* started;
  // without it a token minted for another session would pass every other check.
  if (claims.nonce !== expectedNonce) throw new AuthError("id_token nonce did not match.");
  if (!claims.sub) throw new AuthError("id_token carried no sub.");
  // An unverified address is not an identity — and adr-014 §8 hangs RSVP
  // notification on this address being real.
  if (claims.email_verified !== true && claims.email_verified !== "true") {
    throw new AuthError("Google account email is not verified.");
  }
  if (!claims.email) throw new AuthError("id_token carried no email.");
  return { sub: claims.sub, email: claims.email };
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

/** Cached for an hour, with one forced refetch on an unknown `kid` — that is
 *  exactly what a Google key rotation looks like from here, and re-fetching on
 *  every sign-in would put a network round trip in the flow for nothing. */
async function signingKey(kid: string): Promise<Jwk> {
  const cached = jwksCache?.keys.find((k) => k.kid === kid);
  if (cached && Date.now() - (jwksCache?.fetchedAt ?? 0) < JWKS_TTL_MS) return cached;
  const keys = await fetchJwks();
  const key = keys.find((k) => k.kid === kid);
  if (!key) throw new AuthError(`No Google signing key for kid ${kid}.`);
  return key;
}

async function fetchJwks(): Promise<Jwk[]> {
  const response = await fetch(JWKS_ENDPOINT);
  if (!response.ok) throw new AuthError(`JWKS fetch failed with ${response.status}.`);
  const body = (await response.json()) as { keys?: Jwk[] };
  if (!body.keys?.length) throw new AuthError("JWKS response carried no keys.");
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/** Tests reset this; a long-lived cache would otherwise leak a stubbed key
 *  from one case into the next. */
export function resetJwksCache(): void {
  jwksCache = null;
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new AuthError("id_token segment was not valid JSON.");
  }
}
