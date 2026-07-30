// The keyring (adr-014 §5): the one new read a session authorizes.
//
// It grants nothing by itself. Every host-facing endpoint still checks the
// manage token in constant time, exactly as it did before accounts existed —
// this hands the signed-in browser the tokens it would have had in
// `localStorage` if it had never cleared it, and the client proceeds down the
// paths it already had.

import type { FastifyInstance } from "fastify";
import { deleteUser, listKeyring } from "../accounts.js";
import { clearSessionCookie, currentUser, originAllowed } from "../auth/session.js";
import type { KeyringEntry } from "../schemas.js";
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
}
