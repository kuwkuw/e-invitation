import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { HostInvitation } from "../hostInvitations";
import type { AuthStrings, LandingStrings } from "../i18n";
import { pluralForm } from "../plural";
import { formatRelativeTime } from "../relativeTime";
import type { CountsResult, RsvpCounts } from "../types";

/** How many rows before the list is capped. Enough to be useful, few enough
 *  that the block never pushes the pitch off the screen. */
const VISIBLE = 3;

/**
 * "Your invitations" — the returning-host state of the landing page, not a
 * separate page (adr-010 §4, "landing-page" DS Returning template).
 *
 * Deliberately quiet: a plain surface card with a modest heading, above the
 * pitch but never louder than it. "Create" stays the only accent button on
 * the page.
 *
 * **The list is the view of whichever store owns the identity** (DS
 * `LandingListIsAccount`). Where accounts exist it is the account's, and the
 * caller renders this only for a signed-in host; where they cannot exist
 * (adr-014 §7) the identity is the browser and the list is this browser's.
 * There is no in-between state, so nothing here contrasts the two: signed in
 * the head carries a count, the card gains an account footer and one faint
 * line says the list travels — otherwise the card is just the list.
 *
 * A sign-in offer in this card stays forbidden either way: it would be an
 * advertisement where a host simply wants their list (`LandingSignedInStates`).
 * The door is in the nav, and only the nav.
 */
export function YourInvitations({
  invitations,
  counts,
  signedIn = false,
  footer = null,
  onDeleteAccount,
  t,
  auth,
}: {
  invitations: HostInvitation[];
  /** Per-row counts, keyed by id (adr-012). Absent until the batch resolves —
   *  and it may never resolve; the rows render fully without it. */
  counts?: Map<string, CountsResult>;
  signedIn?: boolean;
  /** The account footer, rendered inside the card. Null when signed out or
   *  when the deployment has no OAuth client at all — in which case nothing
   *  about accounts renders, not even a disabled control (adr-014 §7). */
  footer?: ReactNode;
  onDeleteAccount?: () => void;
  t: LandingStrings;
  auth: AuthStrings;
}) {
  const [expanded, setExpanded] = useState(false);
  // Signed in with nothing published yet: no heading over an empty space, but
  // the card stays, or there would be no way to sign out.
  if (invitations.length === 0) {
    if (!signedIn || !footer) return null;
    return (
      <section className="lp-yours">
        <div className="lp-yours-card">
          <p className="lp-signed-in-empty">{auth.emptySignedIn}</p>
          {footer}
        </div>
      </section>
    );
  }

  const capped = expanded ? invitations : invitations.slice(0, VISIBLE);
  const single = invitations.length === 1;

  return (
    <section className="lp-yours">
      <div className="lp-yours-head">
        <h2>{single ? t.yoursTitleOne : t.yoursTitle}</h2>
        {/* Only signed in. Where the list renders without an account at all
            (adr-014 §7) there is nothing to contrast with, so "on this device"
            would be noise about the only possible state. */}
        {signedIn && (
          <span className="lp-yours-sub">
            {auth.invitationCount.replace("{n}", String(invitations.length))}
          </span>
        )}
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
                {t.yoursPublished.replace(
                  "{when}",
                  formatRelativeTime(invitation.published_at, t.time),
                )}
              </span>
            </span>
            {/* Always present so the slot is sized from the first render and
                the chevron never moves when a count fills in (adr-012 §6). */}
            <span className="lp-yours-stat">
              <RowStat result={counts?.get(invitation.id)} t={t} />
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

        {footer}
      </div>

      {signedIn && (
        // The payoff of the whole feature, and a host has no way to know it
        // otherwise. One line, in the faintest colour on the page.
        <p className="lp-cross-device">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="12" height="9" rx="1.6" stroke="#b0a99a" strokeWidth="1.6" />
            <rect x="14" y="11" width="7" height="10" rx="1.6" stroke="#b0a99a" strokeWidth="1.6" />
          </svg>
          <span>{auth.crossDevice}</span>
        </p>
      )}

      {signedIn && onDeleteAccount && (
        <p className="lp-delete-account">
          <button type="button" className="lp-delete-link" onClick={onDeleteAccount}>
            {auth.deleteAccount}
          </button>
        </p>
      )}
    </section>
  );
}

/** One row's response count and "new" badge. Renders nothing until the row's
 *  own batch result is in and authorized — a row whose token was refused or
 *  gone stays a plain title/time row (adr-012 §6). The count is the replies
 *  received (yes + no over the live answers); the "new" badge is hidden at 0,
 *  since on a first visit "everything is new" tells a host nothing (§4). */
function RowStat({ result, t }: { result: CountsResult | undefined; t: LandingStrings }) {
  if (result?.status !== "ok" || !result.counts) return null;
  const newSince = result.new_since ?? 0;
  return (
    <>
      <span className="lp-yours-count">{repliesLabel(result.counts, t)}</span>
      {newSince > 0 && (
        <span
          className="lp-yours-new"
          role="img"
          aria-label={t.yoursNewAria.replace("{n}", String(newSince))}
        >
          +{newSince}
        </span>
      )}
    </>
  );
}

function repliesLabel(counts: RsvpCounts, t: LandingStrings): string {
  const replies = counts.yes + counts.no;
  if (replies === 0) return t.yoursNoReplies;
  return t.yoursReplies
    .replace("{n}", String(replies))
    .replace("{form}", pluralForm(replies, t.yoursReplyForms));
}
