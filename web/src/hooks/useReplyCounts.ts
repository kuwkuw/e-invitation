import { useEffect, useState } from "react";
import { fetchCounts } from "../api";
import type { PublishResult, RsvpCounts } from "../types";

/**
 * The replies so far for the invitation this editor session published, for
 * the header's link to the dashboard (adr-019 §7.2). `null` until the first
 * publish, and whenever the counts aren't known.
 *
 * It reads adr-012's batch endpoint with one item rather than `/rsvps`. The
 * header shows numbers, and `/rsvps` would bring every guest's name and note
 * into the editor to draw them; the counts endpoint returns FR-5.2's counts
 * and never the list. It sends no `seen_at`, because the header is not a visit
 * to the dashboard and must not move its "N new since your last visit".
 *
 * Fresh without polling, as adr-010 §6 has the dashboard: it asks after each
 * publish or republish (a new `version`) and again when the tab comes back,
 * which is when a host returns from sharing the link in a messenger. A
 * failure keeps whatever it last had and says nothing (adr-012 §6).
 */
export function useReplyCounts(published: PublishResult | null): RsvpCounts | null {
  // Keyed by the id they were read for, so another invitation's numbers can
  // never stand in for this one's while its own are on the way.
  const [counts, setCounts] = useState<{ id: string; counts: RsvpCounts } | null>(null);
  const id = published?.id;
  const token = published?.manage_token;
  const version = published?.version;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` is a trigger, not a read — a republish is when the counts are asked for again.
  useEffect(() => {
    if (!id || !token) return;
    let active = true;
    const load = () => {
      fetchCounts([{ id, token }])
        .then(([result]) => {
          if (active && result?.status === "ok" && result.counts) {
            setCounts({ id, counts: result.counts });
          }
        })
        .catch(() => {
          // Silence is the right failure here: the link still leads to the
          // dashboard, which reports its own errors.
        });
    };
    load();
    function onVisibilityChange() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [id, token, version]);

  return counts && counts.id === id ? counts.counts : null;
}
