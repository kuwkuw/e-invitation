import { useState } from "react";
import type { HostInvitation } from "../hostInvitations";
import type { LandingStrings } from "../i18n";
import { formatRelativeTime } from "../relativeTime";

/** How many rows before the list is capped. Enough to be useful, few enough
 *  that the block never pushes the pitch off the screen. */
const VISIBLE = 3;

/**
 * "Your invitations" — the returning-host state of the landing page, not a
 * separate page (adr-010 §4, "landing-page" DS Returning template).
 *
 * Deliberately quiet: a plain surface card with a modest heading, above the
 * pitch but never louder than it. "Create" stays the only accent button on
 * the page. The list comes from this browser alone, and the subtitle says so
 * rather than implying an account.
 */
export function YourInvitations({
  invitations,
  t,
}: {
  invitations: HostInvitation[];
  t: LandingStrings;
}) {
  const [expanded, setExpanded] = useState(false);
  if (invitations.length === 0) return null;

  const capped = expanded ? invitations : invitations.slice(0, VISIBLE);
  const single = invitations.length === 1;

  return (
    <section className="lp-yours">
      <div className="lp-yours-head">
        <h2>{single ? t.yoursTitleOne : t.yoursTitle}</h2>
        <span className="lp-yours-sub">
          {single
            ? t.yoursOnThisDevice
            : t.yoursCountOnThisDevice.replace("{n}", String(invitations.length))}
        </span>
      </div>

      <div className="lp-yours-card">
        {capped.map((invitation) => (
          <a
            key={invitation.id}
            className="lp-yours-row"
            href={`/manage/${invitation.id}`}
            // The row opens the host dashboard with the token this browser
            // already holds — no password, no sign-in (adr-010 §2).
          >
            <span className={`lp-yours-mono palette-${invitation.palette}`} aria-hidden="true">
              {[...invitation.title.trim()][0]?.toUpperCase() ?? "?"}
            </span>
            <span className="lp-yours-main">
              <span className="lp-yours-title">{invitation.title}</span>
              <span className="lp-yours-when">
                {t.yoursPublished.replace(
                  "{when}",
                  formatRelativeTime(invitation.published_at, t.time),
                )}
              </span>
            </span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ))}

        {!expanded && invitations.length > VISIBLE && (
          <button type="button" className="lp-yours-more" onClick={() => setExpanded(true)}>
            {t.yoursShowAll.replace("{n}", String(invitations.length))}
          </button>
        )}
      </div>
    </section>
  );
}
