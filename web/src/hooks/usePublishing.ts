import { useState } from "react";
import { publishInvitation } from "../api";
import { recordHostInvitation } from "../hostInvitations";
import type { Invitation, PublishResult } from "../types";

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

/**
 * Publishing and the two links it produces. Reading responses is no longer
 * here: that lives at `/manage/:id`, which survives this tab closing, and the
 * panel links to it rather than duplicating the list.
 *
 * Republishing an already-published invitation appends a version rather than
 * minting a new link, so the manage token is kept for the editor session.
 */
export function usePublishing(onError: () => void) {
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manageCopied, setManageCopied] = useState(false);

  /** Publish (or republish) and open the share panel; a second call while the
   *  panel is open just closes it, so the header button toggles. */
  async function share(invitation: Invitation) {
    if (publishing) return;
    if (shareOpen) {
      setShareOpen(false);
      return;
    }
    setPublishing(true);
    try {
      const result = await publishInvitation(
        invitation,
        published ? { id: published.id, manage_token: published.manage_token } : undefined,
      );
      setPublished(result);
      // Read back by /manage/:id, so the host keeps access after this tab is
      // gone — the manage link covers the case where this browser is too.
      localStorage.setItem(`inv-manage:${result.id}`, result.manage_token);
      // And remember the event itself, so the landing page can offer it back
      // by name rather than by id (adr-010 §4).
      recordHostInvitation({
        id: result.id,
        title: invitation.copy.title,
        published_at: new Date().toISOString(),
        palette: invitation.design.palette,
      });
      setShareOpen(true);
    } catch {
      onError();
    } finally {
      setPublishing(false);
    }
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
    share,
    copyLink,
    copyManageLink,
  };
}
