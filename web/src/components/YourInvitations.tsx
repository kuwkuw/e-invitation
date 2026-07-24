import { useState } from "react";
import { Link } from "react-router-dom";
import type { InvitationActivity } from "../hooks/useHostInvitationCounts";
import type { HostInvitation } from "../hostInvitations";
import type { LandingStrings } from "../i18n";
import { pluralForm } from "../plural";
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
  activity,
  t,
}: {
  invitations: HostInvitation[];
  /** Counts per id, filled in after the rows are already on screen (adr-012
   *  §6). An id missing from the map has no number — not a zero. */
  activity: Map<string, InvitationActivity>;
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
          <Link
            key={invitation.id}
            className="lp-yours-row"
            to={`/manage/${invitation.id}`}
            // The row opens the host dashboard with the token this browser
            // already holds — no password, no sign-in (adr-010 §2).
          >
            <span className={`lp-yours-mono palette-${invitation.palette}`} aria-hidden="true">
              {[...invitation.title.trim()][0]?.toUpperCase() ?? "?"}
            </span>
            <span className="lp-yours-main">
              <span className="lp-yours-title">{invitation.title}</span>
              <span className="lp-yours-when">
                {/* Truncates first when the line is tight: on a 375px screen
                    the headcount is what the host came back for, and "when I
                    published this" is what they can afford to lose. */}
                <span className="lp-yours-published">
                  {t.yoursPublished.replace(
                    "{when}",
                    formatRelativeTime(invitation.published_at, t.time),
                  )}
                </span>
                <RowActivity activity={activity.get(invitation.id)} t={t} />
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
          </Link>
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

/**
 * The headcount for one row, and an accent dot when replies arrived since this
 * host last looked (adr-012 §6, the DS Returning template's row treatment).
 *
 * Renders nothing at all until the counts land, and nothing ever for a row
 * whose token was refused: the row is not the place to tell a host their
 * access went stale — `/manage/:id` says that properly, with the recovery.
 * The wrapper is always in the DOM so filling it in does not move the row.
 */
function RowActivity({ activity, t }: { activity?: InvitationActivity; t: LandingStrings }) {
  if (!activity) return <span className="lp-yours-activity" />;
  const { counts, newSince } = activity;

  return (
    <span className="lp-yours-activity">
      <span className="lp-yours-sep" aria-hidden="true">
        ·
      </span>
      {counts.guests > 0 ? (
        <span>
          {t.yoursComing
            .replace("{n}", String(counts.guests))
            .replace("{form}", pluralForm(counts.guests, t.yoursComingForms))}
        </span>
      ) : (
        <span>{t.yoursNoReplies}</span>
      )}
      {newSince > 0 && (
        <span className="lp-yours-new">
          <span className="lp-yours-dot" aria-hidden="true" />
          {t.yoursNew
            .replace("{n}", String(newSince))
            .replace("{form}", pluralForm(newSince, t.yoursNewForms))}
        </span>
      )}
    </span>
  );
}
