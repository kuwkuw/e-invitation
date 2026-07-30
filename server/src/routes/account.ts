// The keyring (adr-014 §5): the one new read a session authorizes.
//
// It grants nothing by itself. Every host-facing endpoint still checks the
// manage token in constant time, exactly as it did before accounts existed —
// this hands the signed-in browser the tokens it would have had in
// `localStorage` if it had never cleared it, and the client proceeds down the
// paths it already had.

import type { FastifyInstance } from "fastify";
import { listKeyring } from "../accounts.js";
import { currentUser } from "../auth/session.js";
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
}
