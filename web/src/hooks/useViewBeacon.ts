import { useEffect } from "react";
import { recordInvitationView } from "../api";
import { hasBeenViewed, markViewed } from "../viewedInvitations";
import type { LoadStatus } from "./usePublishedInvitation";

/**
 * Counts one guest-page view, once per browser per invitation (adr-013 §1).
 *
 * Fires only once the invitation has actually loaded. A dead link is not a
 * view, and neither is a failed request — counting either would put the two
 * states the guest page works hardest to distinguish back into one number.
 *
 * The flag is written *before* the request rather than after it, so a
 * re-invoked effect cannot count twice. That trades a lost view on a failed
 * request for never inventing one, which is the right way round: the number
 * already floats high by construction (§2), and a mechanism that adds to that
 * would compound the one bias the measurement already admits to.
 */
export function useViewBeacon(id: string, status: LoadStatus): void {
  useEffect(() => {
    if (status !== "ready" || hasBeenViewed(id)) return;
    markViewed(id);
    recordInvitationView(id);
  }, [id, status]);
}
