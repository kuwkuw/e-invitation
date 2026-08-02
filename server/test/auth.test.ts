import { generateKeyPairSync, sign as signData } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { resetJwksCache } from "../src/auth/google.js";
import { closeDb } from "../src/db.js";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const KID = "test-key-1";

// A real RSA keypair, so the id_token below is genuinely signed and the
// verification path under test is the production one — not a stub of itself.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });

let app: FastifyInstance | null = null;
let dataDir: string;

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signIdToken(claims: Record<string, unknown>, kid = KID): string {
  const signingInput = `${base64urlJson({ alg: "RS256", kid, typ: "JWT" })}.${base64urlJson(claims)}`;
  const signature = signData("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: "host@example.com",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

/** Google's two endpoints, stubbed at the network boundary — the same place
 *  the LLM tests cut, so no credentials are needed to run the suite. */
function stubGoogle(idToken: string, keys: unknown[] = [{ kid: KID, ...publicJwk }]) {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/token")) return json({ id_token: idToken });
      if (url.includes("/certs")) return json({ keys });
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function configureGoogle() {
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
}

/** Runs the first leg and returns the state and nonce Google would have been
 *  handed, so a callback test can produce a token that actually matches — plus
 *  the binding cookie the browser now holds, which every callback below has to
 *  present. A callback without it is by definition not the browser that started
 *  the flow (adr-014 §3). */
async function beginSignIn(instance: FastifyInstance, redirectTo?: string) {
  const res = await instance.inject({
    method: "GET",
    url: redirectTo
      ? `/api/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`
      : "/api/auth/google",
  });
  const location = new URL(res.headers.location as string);
  return {
    res,
    location,
    state: location.searchParams.get("state") as string,
    nonce: location.searchParams.get("nonce") as string,
    browser: res.cookies.find((c) => c.name === "inv_oauth")?.value as string,
  };
}

/** The second leg, as the browser that started it. */
function completeSignIn(
  instance: FastifyInstance,
  params: { state: string; browser: string; code?: string },
) {
  return instance.inject({
    method: "GET",
    url: `/api/auth/google/callback?code=${params.code ?? "auth-code"}&state=${params.state}`,
    cookies: { inv_oauth: params.browser },
  });
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-auth-test-"));
  process.env.DATA_DIR = dataDir;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetJwksCache();
  closeDb();
  if (app) {
    await app.close();
    app = null;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

// adr-014 §7. The server boots and the whole app works without an OAuth
// client — the same shape as NFR-3's keyless boot for LLM providers.
describe("sign-in unconfigured", () => {
  it("boots, reports it, and refuses to start a flow", async () => {
    app = await buildApp({ logger: false });

    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.json().auth).toEqual({ google: false, publish_gate: false });

    const start = await app.inject({ method: "GET", url: "/api/auth/google" });
    expect(start.statusCode).toBe(503);

    const session = await app.inject({ method: "GET", url: "/api/auth/session" });
    expect(session.json()).toEqual({
      configured: false,
      publish_gate: false,
      // No mail credentials either, so the share panel promises no email
      // (adr-015 §8) — unconfigured across the board is a supported mode.
      notifications: false,
      signed_in: false,
      email: null,
    });
  });
});

describe("google sign-in", () => {
  it("redirects to Google with PKCE, a nonce, and only the openid email scope", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });

    const { res, location, state, nonce } = await beginSignIn(app);
    expect(res.statusCode).toBe(302);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(location.searchParams.get("response_type")).toBe("code");
    // NFR-4: nothing beyond an identity and a verified address is collected.
    expect(location.searchParams.get("scope")).toBe("openid email");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();
    // Derived from the request, which is what makes localhost work with no
    // second registration.
    expect(location.searchParams.get("redirect_uri")).toContain("/api/auth/google/callback");
  });

  it("honours GOOGLE_REDIRECT_URI over the request host", async () => {
    configureGoogle();
    vi.stubEnv("GOOGLE_REDIRECT_URI", "https://invito.example.com/api/auth/google/callback");
    app = await buildApp({ logger: false });

    const { location } = await beginSignIn(app);
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://invito.example.com/api/auth/google/callback",
    );
  });

  it("creates an account and a session on a valid callback", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { state, nonce, browser } = await beginSignIn(app, "/manage/abc123");
    stubGoogle(signIdToken(validClaims({ nonce })));

    const callback = await completeSignIn(app, { state, browser });
    expect(callback.statusCode).toBe(302);
    // Back where the host started, not a generic landing.
    expect(callback.headers.location).toBe("/manage/abc123?auth=ok");

    const cookie = callback.cookies.find((c) => c.name === "inv_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite?.toLowerCase()).toBe("lax");
    // §4: the cookie must never ride /i/:id or the OG image request.
    expect(cookie?.path).toBe("/api");
    // The binding has done its job and does not outlive the flow.
    expect(callback.cookies.find((c) => c.name === "inv_oauth")?.value).toBe("");

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      cookies: { inv_session: cookie?.value as string },
    });
    expect(session.json()).toEqual({
      configured: true,
      publish_gate: true,
      // Sign-in configured, mail not — the two switches are independent
      // (adr-015 §8), so a host can publish and still be promised no email.
      notifications: false,
      signed_in: true,
      email: "host@example.com",
    });
    expect(session.headers["cache-control"]).toBe("no-store");
  });

  it("refuses a replayed state, so a callback works exactly once", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { state, nonce, browser } = await beginSignIn(app);
    stubGoogle(signIdToken(validClaims({ nonce })));

    const first = await completeSignIn(app, { state, browser });
    expect(first.headers.location).toBe("/create?auth=ok");

    const replay = await completeSignIn(app, { state, browser });
    expect(replay.headers.location).toBe("/create?auth=failed&auth_code=state");
    expect(replay.cookies.find((c) => c.name === "inv_session")).toBeUndefined();
  });

  // The state being single-use stops that replay. It does *not* stop an
  // attacker who runs the flow with their own Google account, holds the
  // callback back instead of letting their browser follow it, and gets a victim
  // to open the URL: every check passes and the victim's browser is handed a
  // session for the attacker's account. The victim publishes, the invitation is
  // filed under the attacker's keyring, and §5 hands over its manage token.
  // The binding cookie is the half an attacker cannot write into someone
  // else's browser.
  it("refuses a callback opened in a browser that did not start the flow", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { res, state, nonce, browser } = await beginSignIn(app);
    stubGoogle(signIdToken(validClaims({ nonce })));

    const binding = res.cookies.find((c) => c.name === "inv_oauth");
    expect(binding?.httpOnly).toBe(true);
    expect(binding?.sameSite?.toLowerCase()).toBe("lax");
    // Rides the callback and nothing else.
    expect(binding?.path).toBe("/api/auth");

    // The victim's browser: it holds no binding for this flow.
    const planted = await app.inject({
      method: "GET",
      url: `/api/auth/google/callback?code=auth-code&state=${state}`,
    });
    expect(planted.headers.location).toBe("/create?auth=failed&auth_code=state");
    expect(planted.cookies.find((c) => c.name === "inv_session")).toBeUndefined();

    // And it burned the state, so the browser that *did* start the flow cannot
    // complete it afterwards either — a planted callback costs the attacker
    // their handshake rather than leaving it live.
    const retry = await completeSignIn(app, { state, browser });
    expect(retry.headers.location).toBe("/create?auth=failed&auth_code=state");
    expect(retry.cookies.find((c) => c.name === "inv_session")).toBeUndefined();
  });

  it("refuses a callback carrying another browser's binding", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const attacker = await beginSignIn(app);
    const victim = await beginSignIn(app);
    stubGoogle(signIdToken(validClaims({ nonce: attacker.nonce })));

    const res = await completeSignIn(app, { state: attacker.state, browser: victim.browser });
    expect(res.headers.location).toBe("/create?auth=failed&auth_code=state");
    expect(res.cookies.find((c) => c.name === "inv_session")).toBeUndefined();
  });

  // Each of these is a token that passes every check but one. None may sign in.
  it.each([
    // Ties the token to the sign-in this browser started; without it a token
    // minted for another session passes everything else.
    ["a mismatched nonce", () => validClaims({ nonce: "not-the-nonce" })],
    ["a token issued for another client", (n: string) => validClaims({ nonce: n, aud: "other" })],
    ["an unexpected issuer", (n: string) => validClaims({ nonce: n, iss: "https://evil.example" })],
    [
      "an expired token",
      (n: string) => validClaims({ nonce: n, exp: Math.floor(Date.now() / 1000) - 3600 }),
    ],
    // An unverified address is not an identity, and adr-014 §8 hangs RSVP
    // notification on it being real.
    ["an unverified email", (n: string) => validClaims({ nonce: n, email_verified: false })],
  ])("refuses %s", async (_label, claims) => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { state, nonce, browser } = await beginSignIn(app);
    stubGoogle(signIdToken(claims(nonce)));

    const res = await completeSignIn(app, { state, browser });
    // Every one of these is the identity leg — the token came back from Google
    // and failed verification, so the class is the same and only the log says
    // which claim.
    expect(res.headers.location).toBe("/create?auth=failed&auth_code=identity");
    expect(res.cookies.find((c) => c.name === "inv_session")).toBeUndefined();
  });

  it("refuses a token signed by a key Google does not publish", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { state, nonce, browser } = await beginSignIn(app);
    // Signed with our key, but the JWKS advertises a different kid — what a
    // forged token looks like from here.
    stubGoogle(signIdToken(validClaims({ nonce }), "some-other-kid"));

    const res = await completeSignIn(app, { state, browser });
    expect(res.headers.location).toBe("/create?auth=failed&auth_code=identity");
  });

  // The class is coarse on purpose — three legs, no prose. It exists so a host
  // can read a stable string out to support; why a token was rejected stays in
  // the log.
  it("names the exchange leg when Google's token endpoint refuses", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { state, browser } = await beginSignIn(app);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 400 })),
    );

    const res = await completeSignIn(app, { state, browser });
    expect(res.headers.location).toBe("/create?auth=failed&auth_code=exchange");
  });

  it("treats a cancelled sign-in as declined, not failed", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/google/callback?error=access_denied&state=whatever",
    });
    // The host pressed cancel. It must not read like something broke.
    expect(res.headers.location).toBe("/create?auth=declined");
  });

  // redirect_to comes off the query string and lands in a Location header.
  it.each([
    ["//evil.example", "/create"],
    ["/\\evil.example", "/create"],
    ["https://evil.example", "/create"],
    // A URL parser strips tabs and newlines before it decides what the string
    // means, so these reach `//evil.example` through a guard that only checks
    // for a leading slash pair.
    ["/\t/evil.example", "/create"],
    ["/\n/evil.example", "/create"],
    ["/manage/abc123", "/manage/abc123"],
  ])("guards redirect_to %s", async (requested, expected) => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const { state, nonce, browser } = await beginSignIn(app, requested);
    stubGoogle(signIdToken(validClaims({ nonce })));

    const res = await completeSignIn(app, { state, browser });
    expect(res.headers.location).toBe(`${expected}?auth=ok`);
  });
});

describe("sign-out", () => {
  async function signedInCookie(instance: FastifyInstance) {
    const { state, nonce, browser } = await beginSignIn(instance);
    stubGoogle(signIdToken(validClaims({ nonce })));
    const callback = await completeSignIn(instance, { state, browser });
    return callback.cookies.find((c) => c.name === "inv_session")?.value as string;
  }

  it("revokes the session server-side, not just the cookie", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const value = await signedInCookie(app);

    const out = await app.inject({
      method: "POST",
      url: "/api/auth/signout",
      cookies: { inv_session: value },
    });
    expect(out.statusCode).toBe(204);

    // Replaying the cookie a browser might still hold must not work.
    const after = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      cookies: { inv_session: value },
    });
    expect(after.json().signed_in).toBe(false);
  });

  it("refuses a cross-origin sign-out", async () => {
    configureGoogle();
    app = await buildApp({ logger: false });
    const value = await signedInCookie(app);

    const out = await app.inject({
      method: "POST",
      url: "/api/auth/signout",
      cookies: { inv_session: value },
      headers: { origin: "https://evil.example", host: "localhost:3001" },
    });
    expect(out.statusCode).toBe(403);
  });
});
