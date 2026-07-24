import { useEffect, useState } from "react";
import { fetchRsvpCounts } from "../api";
import type { HostInvitation } from "../hostInvitations";
import type { RsvpCounts } from "../types";
import { manageSeenKey, manageTokenKey } from "./useHostManage";

export interface InvitationActivity {
  counts: RsvpCounts;
  /** Live answers since this browser last opened the dashboard; 0 on a first
   *  visit, because "everything is new" tells a host nothing. */
  newSince: number;
}

/**
 * Response counts for the landing list, one request for all rows (adr-012).
 *
 * The landing page must never wait on this. It renders from the local index
 * synchronously; counts arrive afterwards and fill in, and a failure — offline,
 * a 400, a server that is down — resolves to an empty map so the rows look
 * exactly as they did before this hook existed. A returning host must not be
 * told their invitations are broken because a decorative fetch failed.
 *
 * Only invitations this browser still holds a manage token for are asked
 * about: the index and the tokens live under separate keys, and an entry that
 * outlived its token simply renders without a number.
 */
export function useHostInvitationCounts(
  invitations: HostInvitation[],
): Map<string, InvitationActivity> {
  const [activity, setActivity] = useState<Map<string, InvitationActivity>>(() => new Map());
  // The id list is the whole of what the effect needs — tokens and baselines
  // come from storage — so it is both the dependency and the input. Joining it
  // into a string keeps a caller that rebuilds the array each render from
  // re-firing the request.
  const ids = invitations.map((invitation) => invitation.id).join(",");

  useEffect(() => {
    const items = ids
      .split(",")
      .filter(Boolean)
      .flatMap((id) => {
        const token = localStorage.getItem(manageTokenKey(id));
        if (!token) return [];
        const seenAt = localStorage.getItem(manageSeenKey(id));
        return [{ id, token, ...(seenAt ? { seen_at: seenAt } : {}) }];
      });
    if (items.length === 0) return;

    let active = true;
    fetchRsvpCounts(items)
      .then((response) => {
        if (!active) return;
        const next = new Map<string, InvitationActivity>();
        for (const result of response.results) {
          // Refused and unknown ids carry a status and nothing else; they stay
          // out of the map and their rows render bare. A row is not the place
          // to tell a host their token went stale — /manage/:id says that
          // properly, with the recovery.
          if (result.status !== "ok" || !result.counts) continue;
          next.set(result.id, { counts: result.counts, newSince: result.new_since ?? 0 });
        }
        setActivity(next);
      })
      .catch(() => {
        // Deliberately silent, per above: no counts is the failure mode.
      });
    return () => {
      active = false;
    };
  }, [ids]);

  return activity;
}
