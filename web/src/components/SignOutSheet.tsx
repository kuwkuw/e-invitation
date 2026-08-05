import { useState } from "react";
import type { AuthStrings } from "../i18n";

/**
 * Sign-out confirmation (DS `LandingListIsAccount`, case 2).
 *
 * Sign-out used to be immediate, and could be: the list was the browser's, so
 * ending the session took only the email. Now the list is the account's view,
 * and signing out **removes the list from the page while every manage token
 * stays exactly where it is** — the most counter-intuitive event in the
 * product, because access does not change and visibility does. Something that
 * surprising has to be said before it happens, not discovered after.
 *
 * It is the delete-account sheet's shape deliberately: two neighbouring
 * irreversibilities do not need two languages. The same green reassurance
 * frame, the same asymmetry (the wide control keeps you where you are, the
 * consequence is a line of text), and the same offer to take your keys with
 * you before anything changes.
 *
 * Four things differ from deletion, each for a reason:
 *
 *  - **Two reassurances, not three.** "All your replies are kept" is dropped:
 *    nobody signing out fears losing data, because the account survives. Only
 *    fears that actually arise get answered.
 *  - **No red.** Sign-out is `#6b6659` at weight 700 — the same quiet action
 *    it is in the card footer it was pressed from. Red belongs to account
 *    deletion alone, or it stops meaning anything.
 *  - **The cancel button names a state, not an operation.** "Stay signed in",
 *    never "Cancel": this is a choice between two lasting states rather than
 *    the interruption of a one-off action.
 *  - **The keys are described as staying**, unlike deletion's "save them
 *    first". They are not erased here, and promising a danger that does not
 *    exist is the same fault as hiding one that does.
 */
export function SignOutSheet({
  invitationCount,
  onCopyAllLinks,
  onConfirm,
  onCancel,
  t,
}: {
  invitationCount: number;
  /** Every manage link this browser holds. The one thing sign-out costs is
   *  convenient access, so it is handed back before it is taken. */
  onCopyAllLinks: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  t: AuthStrings;
}) {
  const [copied, setCopied] = useState(false);
  const n = String(invitationCount);

  function copyAll() {
    onCopyAllLinks();
    setCopied(true);
  }

  return (
    <div className="ag-scrim">
      <div className="ag-sheet" role="dialog" aria-modal="true" aria-label={t.signOutTitle}>
        <div className="ag-grab" />
        <h2 className="ag-title da-title">{t.signOutTitle}</h2>

        <div className="da-keep">
          <p className="da-keep-head">{t.signOutKeepCount.replace("{n}", n)}</p>
          <ul className="da-keep-list">
            <li>
              <Tick />
              <span>{t.deleteKeepGuests}</span>
            </li>
            <li>
              <Tick />
              <span>{t.deleteKeepManage}</span>
            </li>
          </ul>
        </div>

        {/* Ordinary weight, because what goes really is small — but it is the
            one thing the host cannot predict, so it is said in words. */}
        <p className="da-goes">{t.signOutOnlyList.replace("{n}", n)}</p>

        <section className="da-keys">
          <p className="da-keys-title">
            <LockIcon />
            {t.signOutKeysHere}
          </p>
          <p className="da-keys-body">{t.signOutKeysBody.replace("{n}", n)}</p>
          <button type="button" className="sp-ghost da-keys-btn" onClick={copyAll}>
            {copied ? t.copyAllLinksDone : t.copyAllLinks.replace("{n}", n)}
          </button>
        </section>

        <button type="button" className="ag-google da-cancel" onClick={onCancel}>
          {t.signOutStay}
        </button>
        <div className="ag-back">
          <button type="button" className="so-confirm" onClick={onConfirm}>
            {t.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="#3d6b47"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="#a97b52" strokeWidth="1.7" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="#a97b52" strokeWidth="1.7" />
    </svg>
  );
}
