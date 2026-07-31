import type { AuthStrings } from "../i18n";

/**
 * Who this browser is signed in as, and the way out (adr-014, DS
 * `LandingSignedInStates`).
 *
 * It lives in the **footer of the invitations card**, not in the page header.
 * The account exists only for that list, so it signs that list. In the header
 * it would compete with the language switcher and the Create button, and an
 * email address is often long — here it can take the width and ellipsise.
 *
 * There is no avatar and no display name because we hold neither: the scope is
 * `openid email` and nothing else.
 */
export function AccountFooter({
  email,
  onSignOut,
  t,
}: {
  email: string;
  onSignOut: () => void;
  t: AuthStrings;
}) {
  return (
    <div className="lp-account">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="#b0a99a" strokeWidth="1.7" />
        <path d="M4.5 8l7.5 5.5L19.5 8" stroke="#b0a99a" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {/* Ellipsised, never wrapped — and "sign out" never shrinks to make room
          for it. */}
      <span className="lp-account-email">{email}</span>
      <button type="button" className="lp-account-out" onClick={onSignOut}>
        {t.signOut}
      </button>
    </div>
  );
}
