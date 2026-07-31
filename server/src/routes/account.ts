// The keyring (adr-014 §5): the one new read a session authorizes.
//
// It grants nothing by itself. Every host-facing endpoint still checks the
// manage token in constant time, exactly as it did before accounts existed —
// this hands the signed-in browser the tokens it would have had in
// `localStorage` if it had never cleared it, and the client proceeds down the
// paths it already had.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { deleteUser, listKeyring } from "../accounts.js";
import { clearSessionCookie, currentUser, originAllowed } from "../auth/session.js";
import { getPref, setNotificationsEnabled } from "../notifications.js";
import { InvitationId, type KeyringEntry, NotificationPrefRequest } from "../schemas.js";
import { getRecord } from "../store.js";

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

  // Reply notifications for one of this account's invitations (adr-015 §7).
  //
  // Session-authorized rather than manage-token-authorized, and that is the
  // one place this feature departs from adr-014 §1's rule that the token is
  // the authority: the preference belongs to an *account* — it is a property
  // of "where do we mail this person" — and the manage token identifies an
  // invitation, not a person. Two accounts holding the same invitation
  // (FR-11.4) have two independent preferences and one shared token, so the
  // token cannot name which one to change.
  //
  // Nothing here touches the invitation, its RSVPs or its manage token, so
  // this grants no access the session did not already have.
  app.get("/api/account/notifications/:id", async (request, reply) => {
    const held = heldInvitation(request);
    if ("error" in held) return reply.code(held.code).send({ error: held.error });
    // Absent row means enabled and never notified — the default is the
    // absence, not a stored value (adr-015 §7).
    return { enabled: getPref(held.userId, held.id)?.enabled ?? true };
  });

  app.put("/api/account/notifications/:id", async (request, reply) => {
    if (!originAllowed(request)) return reply.code(403).send({ error: "Cross-origin request." });
    const held = heldInvitation(request);
    if ("error" in held) return reply.code(held.code).send({ error: held.error });

    let body: NotificationPrefRequest;
    try {
      body = NotificationPrefRequest.parse(request.body);
    } catch {
      return reply.code(400).send({ error: "Expected { enabled: boolean }." });
    }
    return { enabled: setNotificationsEnabled(held.userId, held.id, body.enabled).enabled };
  });
}

/** The signed-in account and a validated invitation id it actually holds.
 *
 *  The keyring check is what stops a session minting preference rows for
 *  invitations it has nothing to do with. It cannot change another host's
 *  preference either way — rows are keyed per (user, invitation) — so this
 *  bounds junk rather than closing a hole. */
function heldInvitation(
  request: FastifyRequest,
): { userId: string; id: string } | { code: number; error: string } {
  const user = currentUser(request);
  if (!user) return { code: 401, error: "Sign in to continue." };

  const id = InvitationId.safeParse((request.params as { id?: string }).id);
  if (!id.success) return { code: 404, error: "Invitation not found." };

  const holds = listKeyring(user.id).some((entry) => entry.invitation_id === id.data);
  if (!holds) return { code: 404, error: "Invitation not found." };

  return { userId: user.id, id: id.data };
}
