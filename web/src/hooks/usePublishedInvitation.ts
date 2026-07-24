import { useEffect, useState } from "react";
import { fetchInvitation } from "../api";
import { isInvitationId } from "../invitationId";
import type { PublishedInvitation } from "../types";

export type LoadStatus = "loading" | "ready" | "not_found" | "error";

/** Loads the public snapshot behind a share link. A missing invitation is a
 *  distinct state from a failed request: the guest page tells them apart
 *  ("this link is dead" vs "try again"). */
export function usePublishedInvitation(id: string) {
  const [published, setPublished] = useState<PublishedInvitation | null>(null);
  // An id the server could never have minted is a dead link, and the guest
  // sees the same thing as for one that expired. Starting at not_found rather
  // than loading keeps a doomed request off the wire and the spinner off the
  // screen (adr-011 §3).
  const [status, setStatus] = useState<LoadStatus>(() =>
    isInvitationId(id) ? "loading" : "not_found",
  );

  useEffect(() => {
    if (!isInvitationId(id)) {
      setStatus("not_found");
      return;
    }
    let active = true;
    setStatus("loading");
    fetchInvitation(id)
      .then((data) => {
        if (!active) return;
        setPublished(data);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (!active) return;
        setStatus(error.message.includes("not found") ? "not_found" : "error");
      });
    // A second id arriving before the first response must not let the stale
    // result win.
    return () => {
      active = false;
    };
  }, [id]);

  return { published, status };
}
