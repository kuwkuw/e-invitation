import { useCallback, useEffect, useState } from "react";
import {
  deleteAccount as deleteAccountRequest,
  fetchAuthSession,
  fetchKeyring,
  signOut as signOutRequest,
} from "../api";
import { type HostInvitation, recordHostInvitation } from "../hostInvitations";
import { writeManageToken } from "../manageTokens";
import type { AuthSession } from "../types";

/** What the app knows about the host's account. `configured: false` is a
 *  deployment with no OAuth client (adr-014 §7) and must render no sign-in
 *  affordance at all — not a disabled one. */
export type AuthStatus = "loading" | "unavailable" | "signed_out" | "signed_in";

/**
 * The signed-in host's account, and the one thing it does: seed this browser
 * with the tokens the account holds (adr-014 §5).
 *
 * The seed goes into the keys the app already runs on — `inv-manage:<id>` and
 * the `inv-invitations` index — so `useHostManage`, `usePublishing`,
 * `useHostInvitationCounts` and `/manage/:id` need no account awareness at
 * all. They keep resolving a manage token exactly as they did before accounts
 * existed; there is simply one more way for that token to be present.
 *
 * **It does expose the list, and that amends §5 rather than drifting from
 * it.** Seeding storage and trusting that whoever reads it does so afterwards
 * is what left a signed-in host on a new device staring at an empty landing
 * list until they reloaded: the read there is synchronous and happens at mount,
 * and this fetch cannot be. Returning the entries also means the list survives
 * a blocked store, the way `manageTokens.ts` already makes the tokens survive
 * one. Every other consumer keeps its account-unawareness — only the landing
 * list learns.
 */
export function useAuthSession() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);
  // What the account holds. `null` is "the keyring has not answered" — signed
  // out, unconfigured, or still in flight — and is deliberately distinct from
  // `[]`, an account that holds nothing: only the second one should be allowed
  // to say anything about a list.
  const [invitations, setInvitations] = useState<HostInvitation[] | null>(null);
  // Whether an anonymous first publish will be refused (adr-014 §2). The
  // editor needs this *before* the host presses Publish, so the gate can be
  // the first frame of the share sheet rather than a reaction to a 401.
  const [publishGate, setPublishGate] = useState(false);
  // Whether the deployment can send reply notifications at all (adr-015 §8).
  // A deployment concern like `publishGate`, not a per-host one: it decides
  // whether the share panel makes a promise about email, and a deployment with
  // no mail credentials must make none.
  const [notifications, setNotifications] = useState(false);

  const apply = useCallback((session: AuthSession) => {
    setPublishGate(session.publish_gate);
    setNotifications(session.notifications);
    if (!session.configured) {
      setStatus("unavailable");
      setEmail(null);
      return false;
    }
    setStatus(session.signed_in ? "signed_in" : "signed_out");
    setEmail(session.email);
    return session.signed_in;
  }, []);

  useEffect(() => {
    let active = true;
    fetchAuthSession()
      .then(async (session) => {
        if (!active) return;
        if (!apply(session)) return;
        const entries = await fetchKeyring();
        if (!active) return;
        const held: HostInvitation[] = [];
        for (const entry of entries) {
          writeManageToken(entry.id, entry.manage_token);
          const invitation = {
            id: entry.id,
            title: entry.title,
            published_at: entry.published_at,
            palette: entry.palette,
          };
          recordHostInvitation(invitation);
          held.push(invitation);
        }
        // After the tokens, never before: `useHostInvitationCounts` refires on
        // the id set changing and reads each token from storage at that moment.
        setInvitations(held);
      })
      .catch(() => {
        // Never a visible failure. A host who is signed out, on a deployment
        // with no OAuth client, or simply offline sees the app they have
        // always had — the manage token in this browser is still the thing
        // that opens their invitations, and it is unaffected by any of this.
        if (active) setStatus((current) => (current === "loading" ? "unavailable" : current));
      });
    return () => {
      active = false;
    };
  }, [apply]);

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } catch {
      // A failed request must not leave the button dead. The next load
      // re-reads /api/auth/session and corrects this if the server session
      // outlived the attempt.
    }
    // The tokens this browser already held stay: signing out ends the account
    // session, it does not revoke the capability the host had before they ever
    // signed in (adr-014 §1). Clearing them here would make sign-out destroy
    // access on a shared device in a way no host would predict — and a host
    // who wants that clears site data.
    setStatus("signed_out");
    setEmail(null);
    // The keyring's answer goes with the session that authorized reading it.
    // The invitations themselves do not disappear from the list: they were
    // seeded into `inv-invitations` on the way in, and that index is exactly
    // what this browser would have had if it had never signed in at all.
    setInvitations(null);
  }, []);

  /** Delete the account (adr-014 §9). Returns how many invitations were kept,
   *  because the honest answer to "will this delete my events" is "no" and the
   *  UI has to be able to say so. Like sign-out, this leaves the tokens in this
   *  browser: they are what the host has left, and taking them would turn
   *  "delete my account" into "lose my invitations". */
  const deleteAccount = useCallback(async () => {
    const result = await deleteAccountRequest();
    setStatus("signed_out");
    setEmail(null);
    setInvitations(null);
    return result;
  }, []);

  return { status, email, invitations, publishGate, notifications, signOut, deleteAccount };
}
