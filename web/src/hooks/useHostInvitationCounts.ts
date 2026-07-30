import { useEffect, useState } from "react";
import { fetchCounts } from "../api";
import { readManageSeen, readManageToken } from "../manageTokens";
import type { CountsRequestItem, CountsResult } from "../types";

/**
 * Per-row response counts for the returning-host landing list (adr-012,
 * FR-5.7). The list renders synchronously from `localStorage`; this fills in
 * counts afterwards and is allowed to fail silently — a returning host must
 * never be told their invitations are broken because a decorative fetch failed
 * (adr-012 §6).
 *
 * Reads each row's manage token and last-seen marker from their own
 * `inv-manage:<id>` / `inv-manage-seen:<id>` keys at request time, so the
 * invitations index stays secret-free (adr-012 §7). Unlike the dashboard, it
 * never advances the seen marker: opening the list must not mark responses the
 * host never looked at.
 *
 * Returns a map keyed by id. A row whose token is gone (cleared storage, an
 * entry that outlived its token) is simply absent from the map and renders
 * without a count.
 */
export function useHostInvitationCounts(ids: string[]): Map<string, CountsResult> {
  const [counts, setCounts] = useState<Map<string, CountsResult>>(() => new Map());
  // The id set only changes by publishing, which happens on another page. The
  // joined key gives the effect a stable primitive dependency so a parent that
  // re-creates the array each render does not refire the request.
  const key = ids.join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `ids` is captured by `key`; tokens are read fresh from storage at request time, never a dependency.
  useEffect(() => {
    // One request for every row that has a token — the list's VISIBLE cap
    // limits what is shown, not what is fetched, so expanding the list fires
    // no second round trip (adr-012 §6).
    const items = ids
      .map((id): CountsRequestItem | null => {
        const token = readManageToken(id);
        if (!token) return null;
        const seen = readManageSeen(id);
        return seen ? { id, token, seen_at: seen } : { id, token };
      })
      .filter((item): item is CountsRequestItem => item !== null);

    if (items.length === 0) return;

    let active = true;
    fetchCounts(items)
      .then((results) => {
        if (!active) return;
        setCounts(new Map(results.map((result) => [result.id, result])));
      })
      .catch(() => {
        // Silence is the correct failure state: rows already render without
        // counts, and a decorative fetch must not surface an error (adr-012 §6).
      });
    return () => {
      active = false;
    };
  }, [key]);

  return counts;
}
