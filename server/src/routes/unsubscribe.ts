// One-click unsubscribe (adr-015 §7). Two routes and a page, no session.
//
// **Outside `/api` on purpose.** The session cookie is scoped `Path=/api`
// (adr-014 §4), and this URL arrives from an inbox — it should not carry a
// session credential to a link a mail provider may fetch on the reader's
// behalf. Everything under `/api` also answers JSON, and this answers HTML.
//
// The token is the whole credential and it can do exactly one thing: turn this
// account's reply email off. It reaches no manage token, no keyring row and no
// invitation, so a leaked one costs a host their notifications and nothing
// else.

import type { FastifyInstance, FastifyReply } from "fastify";
import { disableByUnsubToken, prefByUnsubToken } from "../notifications.js";
import { pageLanguage, renderUnsubscribePage, type UnsubscribeState } from "../unsubscribePage.js";

/** The token is opaque and never echoed into the page, but it does go into the
 *  form action and the language link, so it is bounded to what `randomBytes`
 *  base64url actually produces rather than trusted by length alone. */
const TOKEN = /^[\w-]{1,64}$/;

export function registerUnsubscribeRoutes(app: FastifyInstance): void {
  // RFC 8058's one-click POST arrives as `application/x-www-form-urlencoded`
  // with `List-Unsubscribe=One-Click`. Fastify parses JSON only, so without
  // this the mail provider's request is a 415 and the header is worse than
  // useless — it advertises a button that fails. The body is not read: the
  // token in the path is the whole request.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, _body, done) => done(null, {}),
  );

  // GET never mutates. Mail scanners, corporate link checkers and Gmail's
  // proxy all follow links in mail without a human, so a GET that unsubscribed
  // would opt hosts out via their own provider — silently, and with no way for
  // them to tell what happened. This shows a button instead.
  app.get("/unsubscribe/:id", async (request, reply) => {
    const token = tokenOf(request.params);
    const language = pageLanguage(request.headers["accept-language"], langOf(request.query));
    // Already off is "done", not "dead": the host asked for this and arriving
    // twice should confirm it, not imply something broke.
    const pref = token ? prefByUnsubToken(token) : null;
    const state: UnsubscribeState = !pref ? "dead" : pref.enabled ? "confirm" : "done";
    return html(reply, renderUnsubscribePage(state, language, token ?? ""));
  });

  // The mutation. No origin check, unlike the cookie-authorized mutations
  // (adr-014 §4): a one-click POST comes from the mail provider's servers and
  // is cross-origin by definition. The token is unguessable and does the
  // authorizing.
  app.post("/unsubscribe/:id", async (request, reply) => {
    const token = tokenOf(request.params);
    const language = pageLanguage(request.headers["accept-language"], langOf(request.query));
    if (!token) return html(reply, renderUnsubscribePage("dead", language, ""));

    // Idempotent: a second press is still "done". `disableByUnsubToken`
    // reports whether the token resolved, which is the only thing that
    // distinguishes a real link from an invented one.
    const known = disableByUnsubToken(token) || prefByUnsubToken(token) !== null;
    return html(reply, renderUnsubscribePage(known ? "done" : "dead", language, token));
  });
}

function tokenOf(params: unknown): string | null {
  const id = (params as { id?: string }).id;
  return typeof id === "string" && TOKEN.test(id) ? id : null;
}

function langOf(query: unknown): string | undefined {
  return (query as { lang?: string }).lang;
}

function html(reply: FastifyReply, body: string) {
  // no-store because the page reflects a preference that the reader is in the
  // middle of changing, and never indexed — it is reachable only from mail.
  return reply
    .header("Content-Type", "text/html; charset=utf-8")
    .header("Cache-Control", "no-store")
    .header("X-Robots-Tag", "noindex")
    .send(body);
}
