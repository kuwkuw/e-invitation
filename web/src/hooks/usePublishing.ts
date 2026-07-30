import { useCallback, useState } from "react";
import { ApiError, publishInvitation, startGoogleSignIn } from "../api";
import { clearDraft, hasDraft, saveDraft } from "../draft";
import { recordHostInvitation } from "../hostInvitations";
import { writeManageToken } from "../manageTokens";
import type { GenerateSource, Invitation, PublishResult } from "../types";
import type { AuthReturn } from "./useAuthReturn";

export function shareUrl(id: string): string {
  return `${window.location.origin}/i/${id}`;
}

/** The host's own way back in (adr-010 §2-3). The token rides the fragment, so
 *  it never reaches the server in a request line — and this link is a bearer
 *  secret: whoever holds it can read every response and republish. The UI
 *  treats it accordingly. */
export function manageUrl(id: string, manageToken: string): string {
  return `${window.location.origin}/manage/${id}#t=${manageToken}`;
}

/** Just enough of a published record to republish it: what the draft parks
 *  across the redirect, and what `PublishResult` structurally satisfies. */
type Republishable = { id: string; manage_token: string };

/** The frames of the publish sheet before the links exist (adr-014 §2, DS
 *  `AuthGateStates`). Not separate screens: one container whose contents
 *  change, mounted the moment the host presses Publish. */
export type GateState = "prompt" | "redirecting" | "returning" | "declined" | "failed";

/**
 * Publishing and the two links it produces. Reading responses is no longer
 * here: that lives at `/manage/:id`, which survives this tab closing, and the
 * panel links to it rather than duplicating the list.
 *
 * Republishing an already-published invitation appends a version rather than
 * minting a new link, so the manage token is kept for the editor session.
 *
 * It also owns the sign-in gate, because the gate *is* a state of publishing —
 * the first frame of the same sheet, not a separate concern that interrupts it.
 */
export function usePublishing(
  onError: () => void,
  options: {
    /** Whether this deployment refuses an anonymous first publish, and whether
     *  we already have an account. Both come from the session, read before the
     *  host presses anything. */
    gated?: boolean;
    signedIn?: boolean;
    /** Where the host arrived from, parked with the draft so an interrupted
     *  publish still counts as referred (adr-013 §3). */
    source?: GenerateSource;
    /** The sign-in result we came back with, if this mount is a return trip. */
    authReturn?: AuthReturn | null;
    authCode?: string | null;
  } = {},
) {
  const { gated = false, signedIn = false, source = "direct", authReturn = null } = options;
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manageCopied, setManageCopied] = useState(false);
  // Seeded from the return trip: a host coming back from Google lands straight
  // in `returning` (or in the outcome they chose), never back in `prompt`.
  const [gate, setGate] = useState<GateState | null>(() =>
    authReturn === "ok" ? "returning" : authReturn,
  );
  const [manageShown, setManageShown] = useState(false);

  const finish = useCallback((result: PublishResult, invitation: Invitation) => {
    setPublished(result);
    // Read back by /manage/:id, so the host keeps access after this tab is
    // gone. The accessor swallows a blocked store on its own — a publish that
    // already succeeded server-side must not fail on a bookkeeping write.
    writeManageToken(result.id, result.manage_token);
    // And remember the event itself, so the landing page can offer it back by
    // name rather than by id (adr-010 §4).
    recordHostInvitation({
      id: result.id,
      title: invitation.copy.title,
      published_at: new Date().toISOString(),
      palette: invitation.design.palette,
    });
    clearDraft();
    setGate(null);
    setShareOpen(true);
  }, []);

  const publish = useCallback(
    async (invitation: Invitation, existing: Republishable | null) => {
      setPublishing(true);
      try {
        const result = await publishInvitation(
          invitation,
          existing ? { id: existing.id, manage_token: existing.manage_token } : undefined,
        );
        finish(result, invitation);
      } catch (error) {
        // A 401 means the session lapsed between page load and this press —
        // the gate we skipped because the session said we were signed in. Fall
        // into it rather than reporting a generic publish failure.
        if (error instanceof ApiError && error.status === 401) {
          saveDraft({ invitation, source, published: existing });
          setGate("prompt");
        } else {
          onError();
        }
      } finally {
        setPublishing(false);
      }
    },
    [finish, onError, source],
  );

  /** Publish (or republish) and open the share panel; a second call while the
   *  panel is open just closes it, so the header button toggles. */
  async function share(invitation: Invitation) {
    if (publishing) return;
    if (shareOpen) {
      setShareOpen(false);
      return;
    }
    // The gate opens on the press, not on a 401: the sheet is the first frame
    // of the share panel the host is already expecting, so it has to be there
    // before any round trip. A republish carries a manage token and is never
    // gated (adr-014 §1), so only a first publish asks.
    if (gated && !signedIn && !published) {
      saveDraft({ invitation, source, published: null });
      setGate("prompt");
      return;
    }
    await publish(invitation, published);
  }

  /** Leave for Google. Re-parks the draft first, so an edit made while the
   *  sheet was open is not lost either. */
  function signInAndPublish(invitation: Invitation) {
    saveDraft({ invitation, source, published });
    setGate("redirecting");
    startGoogleSignIn("/create");
  }

  /** Resume the publish the gate interrupted, once, when a host returns signed
   *  in. The sheet is already showing `returning`. */
  const resume = useCallback(
    async (invitation: Invitation, existing: Republishable | null) => {
      await publish(invitation, existing);
    },
    [publish],
  );

  function dismissGate() {
    setGate(null);
    clearDraft();
  }

  async function copyLink() {
    if (!published) return;
    await navigator.clipboard.writeText(shareUrl(published.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Separate from `copyLink` on purpose: separate action, separate
   *  confirmation, and the confirmation repeats the warning. */
  async function copyManageLink() {
    if (!published) return;
    await navigator.clipboard.writeText(manageUrl(published.id, published.manage_token));
    setManageCopied(true);
    setTimeout(() => setManageCopied(false), 3000);
  }

  return {
    published,
    publishing,
    shareOpen,
    copied,
    manageCopied,
    gate,
    /** Whether the draft actually reached storage — the gate says "draft saved
     *  in this browser" and must not claim that when the write was refused. */
    draftSaved: hasDraft(),
    authCode: options.authCode ?? null,
    /** Signed-in hosts get the manage block collapsed behind "Show": they
     *  rarely need it, and the warning then appears with the copy button it
     *  guards, never without it (DS `ShareSignedIn`). */
    manageShown,
    toggleManageShown: () => setManageShown((open) => !open),
    share,
    signInAndPublish,
    resume,
    dismissGate,
    copyLink,
    copyManageLink,
  };
}
