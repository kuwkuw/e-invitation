// The keyring (adr-014 §5): the one new read a session authorizes.
//
// It grants nothing by itself. Every host-facing endpoint still checks the
// manage token in constant time, exactly as it did before accounts existed —
// this hands the signed-in browser the tokens it would have had in
// `localStorage` if it had never cleared it, and the client proceeds down the
// paths it already had.

import type { FastifyInstance } from "fastify";
import { deleteUser, linkInvitation, listKeyring } from "../accounts.js";
import { clearSessionCookie, currentUser, originAllowed } from "../auth/session.js";
import { getPref, setNotificationsEnabled } from "../notifications.js";
import {
  ClaimRequest,
  type ClaimResult,
  type KeyringEntry,
  NotificationPrefRequest,
} from "../schemas.js";
import { getRecord, tokenMatches } from "../store.js";

export function registerAccountRoutes(app: FastifyInstance): void {
  app.get("/api/account/keyring", async (request, reply) => {
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: "Sign in to continue." });

    // Per-host data keyed by secrets — nothing between the browser and the
    // process should retain it (the adr-012 §1 rule, and this response is a
    // batch of credentials rather than a batch of counts).
    reply.header("Cache-Control", "no-store");

    const invitations: KeyringEntry[] = [];
    for (const entry of listKeyring(user.id)) {
      const record = getRecord(entry.invitation_id);
      // A row whose record is gone is skipped, not repaired: a read path that
      // deletes is a surprising thing to debug, and a dangling row costs a
      // `readFileSync` miss on a list bounded by how many events one person
      // has published.
      if (!record) continue;
      const latest = record.versions[record.versions.length - 1];
      if (!latest) continue;
      invitations.push({
        id: record.id,
        // Read off the record, which is the only place it is stored.
        manage_token: record.manage_token,
        title: latest.copy.title,
        published_at: record.created_at,
        palette: latest.design.palette,
      });
    }
    return { invitations };
  });

  // File the invitations this browser can prove it holds into the account's
  // keyring — the step that makes signing in on a new device show the events a
  // host published before they ever had an account.
  //
  // Without it the landing list is permanently two-class: rows the account
  // knows, and rows only this browser knows, with no way for the second to
  // ever become the first. The manage token is what settles that, and it is
  // not a new authority — it is the same proof `/manage/:id` has always run
  // on, checked here the same constant-time way (adr-014 §1).
  //
  // Per-item, like the batch counts (adr-012 §2): a stale token blanks its own
  // row and no other, because a browser that has held tokens for a year will
  // have some that no longer resolve, and one of them must not cost the host
  // the rest of their events.
  app.post("/api/account/claim", async (request, reply) => {
    if (!originAllowed(request)) return reply.code(403).send({ error: "Cross-origin request." });
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: "Sign in to continue." });

    let body: ClaimRequest;
    try {
      body = ClaimRequest.parse(request.body);
    } catch {
      return reply.code(400).send({ error: "Expected { items: [{ id, token }] }." });
    }

    // The request body is a batch of credentials, exactly like the keyring
    // response is (adr-012 §1) — nothing in between should retain it.
    reply.header("Cache-Control", "no-store");

    let linked = 0;
    const results: ClaimResult[] = body.items.map((item) => {
      const record = getRecord(item.id);
      if (!record) return { id: item.id, status: "not_found" };
      if (!tokenMatches(record, item.token)) return { id: item.id, status: "forbidden" };
      if (linkInvitation(user.id, item.id)) linked += 1;
      return { id: item.id, status: "ok" };
    });
    return { results, linked };
  });

  // adr-014 §9. Deleting an account removes the user, their sessions and their
  // keyring — and deliberately **not** the invitations they published or the
  // RSVPs guests left on them:
  //
  //  - the share links guests already hold must not break,
  //  - the RSVP rows are the guests' data, not the host's, and
  //  - the manage token survives on the record, so a host who kept their
  //    manage link still has access.
  //
  // Deletion removes the account, not the event. The response says as much, so
  // the UI can tell the host what actually happened rather than implying their
  // invitations are gone.
  app.delete("/api/account", async (request, reply) => {
    if (!originAllowed(request)) return reply.code(403).send({ error: "Cross-origin request." });
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: "Sign in to continue." });

    // Counted before the rows go, so the host is told the true number.
    const retained = listKeyring(user.id).filter((e) => getRecord(e.invitation_id) !== null).length;
    deleteUser(user.id);
    clearSessionCookie(request, reply);
    return { deleted: true, invitations_retained: retained };
  });

  // Reply notifications for this account (adr-015 §7). Not per invitation:
  // one-click unsubscribe is presented by mail clients as "stop sending me
  // this kind of mail", and a host who clicks it and keeps receiving mail
  // about their other events reports the next one as spam.
  //
  // Session-authorized rather than manage-token-authorized, and that is the
  // one place this feature departs from adr-014 §1's rule that the token is
  // the authority: the preference is a property of "where do we mail this
  // person", and the manage token identifies an invitation, not a person.
  //
  // Nothing here touches an invitation, its RSVPs or its manage token, so this
  // grants no access the session did not already have.
  app.get("/api/account/notifications", async (request, reply) => {
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: "Sign in to continue." });
    // Absent row means **disabled**: reply email is opt-in (adr-015 §7,
    // amended). Nothing is sent to an account that has not asked, and the
    // default is still the absence of a row rather than a stored value.
    return { enabled: getPref(user.id)?.enabled ?? false };
  });

  app.put("/api/account/notifications", async (request, reply) => {
    if (!originAllowed(request)) return reply.code(403).send({ error: "Cross-origin request." });
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: "Sign in to continue." });

    let body: NotificationPrefRequest;
    try {
      body = NotificationPrefRequest.parse(request.body);
    } catch {
      return reply.code(400).send({ error: "Expected { enabled: boolean }." });
    }
    return { enabled: setNotificationsEnabled(user.id, body.enabled).enabled };
  });
}
