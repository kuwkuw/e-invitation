// One-time state for an in-flight sign-in (adr-014 §3). Kept server-side in
// SQLite rather than in a cookie: it survives a deploy mid-redirect, and the
// `state` value stays single-use by construction — reading it deletes it, so a
// replayed callback finds nothing.
//
// The row carries everything the callback cannot re-derive safely: the PKCE
// verifier, the nonce to match against the id_token, the exact `redirect_uri`
// sent to Google, which the token exchange has to repeat byte-for-byte, and the
// hash of the cookie that binds the flow to one browser.
//
// **Single-use is not the same as browser-bound**, which is why that last one
// exists. Single-use stops the same callback being replayed. It does nothing
// against an attacker who runs the flow with their own Google account, holds
// the callback back instead of letting their browser follow it, and gets a
// victim to open it: every check passes, and the victim's browser is handed a
// session for the attacker's account. The victim then publishes, `linkInvitation`
// files it under the attacker's keyring, and §5 hands over the manage token.
// The binding cookie is the one thing in the exchange an attacker cannot write
// into someone else's browser.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "../db.js";

export interface OauthState {
  state: string;
  nonce: string;
  code_verifier: string;
  redirect_uri: string;
  redirect_to: string;
  /** sha256 of the browser's binding cookie, never the value itself — the
   *  asymmetry `accounts.ts` applies to session ids, for the same reason. */
  browser_key: string;
}

// Long enough for a host to pick an account and type a password, short enough
// that an abandoned attempt is not a row that lives forever.
const STATE_TTL_MS = 10 * 60 * 1000;

export function createOauthState(input: {
  redirectUri: string;
  redirectTo: string;
  /** The value the caller is about to put in the browser's binding cookie. */
  browserKey: string;
}): OauthState & {
  code_challenge: string;
} {
  const row: OauthState = {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    code_verifier: randomBytes(32).toString("base64url"),
    redirect_uri: input.redirectUri,
    redirect_to: input.redirectTo,
    browser_key: browserKeyHash(input.browserKey),
  };
  getDb()
    .prepare(
      "INSERT INTO oauth_states" +
        " (state, nonce, code_verifier, redirect_uri, redirect_to, browser_key, expires_at)" +
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      row.state,
      row.nonce,
      row.code_verifier,
      row.redirect_uri,
      row.redirect_to,
      row.browser_key,
      new Date(Date.now() + STATE_TTL_MS).toISOString(),
    );
  return { ...row, code_challenge: codeChallenge(row.code_verifier) };
}

/** Read **and delete**, so a state is good for exactly one callback. Returns
 *  null for unknown, expired or already-used — the caller cannot tell them
 *  apart, and does not need to. */
export function consumeOauthState(state: string): OauthState | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT state, nonce, code_verifier, redirect_uri, redirect_to, browser_key" +
        " FROM oauth_states WHERE state = ? AND expires_at > ?",
    )
    .get(state, new Date().toISOString()) as OauthState | undefined;
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  return row ?? null;
}

/** A fresh binding value for one sign-in. It goes in the cookie; only its hash
 *  goes in the row. */
export function newBrowserKey(): string {
  return randomBytes(16).toString("base64url");
}

/** Whether this callback is arriving in the browser that started the flow.
 *
 *  False for a missing cookie and false for a row from before the column
 *  existed (`''`), so every path that cannot prove the binding fails — an
 *  absent credential is never a passing one. Compared the way `tokenMatches`
 *  compares a manage token. */
export function browserKeyMatches(row: OauthState, cookieValue: string | undefined): boolean {
  if (!cookieValue || !row.browser_key) return false;
  const expected = Buffer.from(row.browser_key);
  const actual = Buffer.from(browserKeyHash(cookieValue));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function browserKeyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pruneExpiredOauthStates(): number {
  const result = getDb()
    .prepare("DELETE FROM oauth_states WHERE expires_at <= ?")
    .run(new Date().toISOString());
  return Number(result.changes);
}

/** PKCE S256. The verifier never leaves the server, so this is belt to the
 *  client secret's braces rather than the load-bearing control it is for a
 *  public client — but it costs two lines and closes code interception. */
function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
