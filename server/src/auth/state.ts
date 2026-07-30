// One-time state for an in-flight sign-in (adr-014 §3). Kept server-side in
// SQLite rather than in a cookie: it survives a deploy mid-redirect, and the
// `state` value stays single-use by construction — reading it deletes it, so a
// replayed callback finds nothing.
//
// The row carries everything the callback cannot re-derive safely: the PKCE
// verifier, the nonce to match against the id_token, and the exact
// `redirect_uri` sent to Google, which the token exchange has to repeat
// byte-for-byte.

import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../db.js";

export interface OauthState {
  state: string;
  nonce: string;
  code_verifier: string;
  redirect_uri: string;
  redirect_to: string;
}

// Long enough for a host to pick an account and type a password, short enough
// that an abandoned attempt is not a row that lives forever.
const STATE_TTL_MS = 10 * 60 * 1000;

export function createOauthState(input: { redirectUri: string; redirectTo: string }): OauthState & {
  code_challenge: string;
} {
  const row: OauthState = {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    code_verifier: randomBytes(32).toString("base64url"),
    redirect_uri: input.redirectUri,
    redirect_to: input.redirectTo,
  };
  getDb()
    .prepare(
      "INSERT INTO oauth_states (state, nonce, code_verifier, redirect_uri, redirect_to, expires_at)" +
        " VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      row.state,
      row.nonce,
      row.code_verifier,
      row.redirect_uri,
      row.redirect_to,
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
      "SELECT state, nonce, code_verifier, redirect_uri, redirect_to FROM oauth_states" +
        " WHERE state = ? AND expires_at > ?",
    )
    .get(state, new Date().toISOString()) as OauthState | undefined;
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  return row ?? null;
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
