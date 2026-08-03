import { Link } from "react-router-dom";
import type { GuestStrings } from "../../i18n";

/**
 * The guest page's only link back to the product (adr-013 §7), and the whole
 * of the share loop 07-monetization §3 says is the only acquisition channel
 * the economics can afford.
 *
 * The wordmark keeps the exact values it had as a static `gr-brand`. The DS
 * guest-rsvp template states the intent this has to respect — "INVINTO stays a
 * whisper" — so the action is one muted line beneath it, in the same treatment
 * as `gr-change` elsewhere on the page. Nothing on the page gets louder; one
 * thing becomes legible as an action.
 *
 * One component rather than a treatment scattered across guest states,
 * because §5.2 proposes selling the removal of exactly this.
 *
 * `?ref=guest` is what PR 4 reads into the generate request's `source`. It
 * carries no invitation id: per-invitation credit would build the host graph
 * adr-012 and adr-005 both refused.
 */
export function GuestCta({ t }: { t: GuestStrings }) {
  return (
    <Link className="gr-cta" to="/create?ref=guest">
      {/* Hidden from the accessible name so the link reads as its action —
          "create your own invitation", not "INVINTO create your own …". */}
      <span className="gr-cta-mark" aria-hidden="true">
        INVINTO
      </span>
      <span className="gr-cta-line">{t.ctaLine}</span>
    </Link>
  );
}
