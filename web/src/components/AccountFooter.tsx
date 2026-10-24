import type { AuthStrings } from "../i18n";
import { NotifyCheckbox } from "./NotifyCheckbox";

/**
 * Who this browser is signed in as, what we send them, and the way out
 * (adr-014 + adr-015 §7, design project `LandingSignedInStates` / `LandingAccountNotify`).
 *
 * It lives in the **footer of the invitations card**, not in the page header.
 * The account exists only for that list, so it signs that list. In the header
 * it would compete with the language switcher and the Create button, and an
 * email address is often long — here it can take the width and ellipsise.
 *
 * There is no avatar and no display name because we hold neither: the scope is
 * `openid email` and nothing else.
 *
 * **Reply email lives here because this is the only account surface.** The
 * share panel asks at publish, which is the moment it is caused — but a moment
 * is not an address, and until this existed the only durable way to turn reply
 * email off was to go and find one of the emails. Since adr-019 §10 it is a
 * checkbox (`NotifyCheckbox`), not a sentence with a text button: under opt-in
 * it is the only thing between the feature and its non-existence.
 *
 * What it deliberately is not: no heading over the row, because a heading is
 * the first thing that turns a fact into a settings section — and a checkbox's
 * caption is its sentence, so it needs none. No divider between the two rows
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
   *  host with no invitations yet — renders no control at all rather than a
   *  disabled one: a dead control promises a feature that is not there, and
   *  before the first invitation the preference is about nothing. */
  notify?: { enabled: boolean; onToggle: () => void } | null;
  t: AuthStrings;
}) {
  return (
    <div className="lp-account">
      <div className="lp-account-id">
        {/* The envelope labels the address, and only that. It used to be
            struck when mail was off, because there was no control to carry
            the state; the checkbox below carries it now, and two state glyphs
            in one stack would argue (adr-019 §10). */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M4.5 8l7.5 5.5L19.5 8"
            stroke="currentColor"
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
        // Indented to the address above rather than to the glyph, so the block
        // reads as one column of text the envelope signs. The state row never
        // names the address: it is one line up, and saying it twice in one
        // block is the one thing this footer has always avoided.
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
