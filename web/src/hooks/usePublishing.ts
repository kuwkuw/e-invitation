import { useState } from "react";
import { fetchRsvps, publishInvitation } from "../api";
import type { Invitation, PublishResult, RsvpSummary } from "../types";

export function shareUrl(id: string): string {
  return `${window.location.origin}/i/${id}`;
}

/**
 * Publishing and everything gated behind it: the share link, the copy-link
 * confirmation, and the host's RSVP list. Republishing an already-published
 * invitation appends a version rather than minting a new link, so the
 * manage token is kept for the lifetime of the editor session.
 */
export function usePublishing(onError: () => void) {
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rsvps, setRsvps] = useState<RsvpSummary | null>(null);
  const [rsvpsLoading, setRsvpsLoading] = useState(false);

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
      // Survives a reload of the editor, which otherwise loses the token and
      // with it the ability to republish or read responses.
      localStorage.setItem(`inv-manage:${result.id}`, result.manage_token);
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

  async function refreshRsvps() {
    if (!published || rsvpsLoading) return;
    setRsvpsLoading(true);
    try {
      setRsvps(await fetchRsvps(published.id, published.manage_token));
    } finally {
      setRsvpsLoading(false);
    }
  }

  return {
    published,
    publishing,
    shareOpen,
    copied,
    rsvps,
    rsvpsLoading,
    share,
    copyLink,
    refreshRsvps,
  };
}
