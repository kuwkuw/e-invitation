import type { AuthStrings } from "../i18n";
import { NotifyCheckbox } from "./NotifyCheckbox";

/**
 * Who this browser is signed in as, what we send them, and the way out
 * (adr-014 + adr-015 §7, DS `LandingSignedInStates` / `LandingAccountNotify`).
 *
 * It lives in the **footer of the invitations card**, not in the page header.
 * The account exists only for that list, so it signs that list. In the header
 * it would compete with the language switcher and the Create button, and an
 * email address is often long — here it can take the width and ellipsise.
 *
 * There is no avatar and no display name because we hold neither: the scope is
 * `openid email` and nothing else.
 *
 * **The notification line lives here because this is the only account
 * surface.** The share panel discloses it at publish, which is the moment it is
 * caused — but a moment is not an address, and until this existed the only
 * durable way to turn reply email off was to go and find one of the emails.
 * The rule this footer follows is not "one thing" but "the account": it already
 * carried two of them, they simply fit on one line.
 *
 * What it deliberately is not: no heading over the row, because a heading is
 * the first thing that turns a fact into a settings section — the same
 * reasoning that ruled out a toggle switch. No divider between the two rows
 * either; they are one stack about the account. And "delete account" stays
 * outside this card: the split is by consequence, not by topic — in here are
 * the things you can press and change your mind about.
 */
export function AccountFooter({
  email,
  onSignOut,
  notify,
  t,
}: {
  email: string;
  onSignOut: () => void;
  /** Reply notifications. Absent — a deployment that cannot send mail, or a
   *  host with no invitations yet — renders no line at all rather than a
   *  disabled one: a dead control promises a feature that is not there, and
   *  before the first invitation the preference is about nothing. */
  notify?: { enabled: boolean; onToggle: () => void } | null;
  t: AuthStrings;
}) {
  return (
    <div className="lp-account">
      <div className="lp-account-id">
        {/* No strike any more. The envelope was carrying the state because
            there was no control to carry it; with the checkbox below, two
            state glyphs in one stack would argue. It stays as a label for the
            address — which is all it ever needed to be — and the #fbfaf7
            knockout the strike required goes with it. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="2" stroke="#b0a99a" strokeWidth="1.7" />
          <path
            d="M4.5 8l7.5 5.5L19.5 8"
            stroke="#b0a99a"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {/* Ellipsised, never wrapped — and "sign out" never shrinks to make room
            for it. */}
        <span className="lp-account-email">{email}</span>
        <button type="button" className="lp-account-out" onClick={onSignOut}>
          {t.signOut}
        </button>
      </div>

      {notify && (
        // Indented to the address above rather than to the glyph (16px + 10px
        // gap) so the block reads as one vertical line of text that the
        // envelope signs. The action is on its own line for the reason the
        // share panel already learned: on a row that has spent its width on an
        // ellipsised address, a baseline-aligned button has nowhere to go.
        // Indented to the address above rather than to the glyph, so the block
        // reads as one vertical line of text the envelope signs. The state row
        // carries no address here — it is 26px above, and saying it twice in
        // one block would be the one thing this footer has always avoided.
        <div className="lp-account-mail">
          <NotifyCheckbox
            checked={notify.enabled}
            onToggle={notify.onToggle}
            name={t.notifyOptIn}
            state={notify.enabled ? t.notifyStateOnAccount : t.notifyStateOffNow}
          />
        </div>
      )}
    </div>
  );
}
