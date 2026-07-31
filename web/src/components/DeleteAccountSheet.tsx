import { useState } from "react";
import type { AuthStrings } from "../i18n";

/**
 * Account deletion (adr-014 §9, DS `LandingSignedInStates`).
 *
 * Almost every host will assume deleting the account deletes their events and
 * breaks their guests' links. It does neither. So the reassurance is not fine
 * print under a red button — **it is the content of the screen**, and the
 * biggest text on it after the title.
 *
 * The reading order is deliberate: what stays (largest) → the three specific
 * fears, each answered on its own line → what actually goes (ordinary weight,
 * because it really is small) → a chance to keep the one thing that is lost →
 * cancel, wide and outlined, with delete as a text link beneath it.
 *
 * Deliberately absent, per the DS board: no filled red button, no
 * type-DELETE-to-confirm, no fine print, and no "this cannot be undone" — true,
 * but it would be the loudest sentence on a screen whose whole job is to say
 * the opposite.
 */
export function DeleteAccountSheet({
  invitationCount,
  replyCount,
  onCopyAllLinks,
  onConfirm,
  onCancel,
  t,
}: {
  invitationCount: number;
  replyCount: number;
  /** Copies every manage link this browser holds — the one real loss is
   *  convenience of access, so we hand it back before taking it away. */
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
      <div className="ag-sheet" role="dialog" aria-modal="true" aria-label={t.deleteTitle}>
        <div className="ag-grab" />
        <h2 className="ag-title da-title">{t.deleteTitle}</h2>

        {/* The loudest thing on the screen, because it is the true thing the
            host most needs and least expects. */}
        <div className="da-keep">
          <p className="da-keep-head">{t.deleteHeadline.replace("{n}", n)}</p>
          <ul className="da-keep-list">
            <li>
              <Tick />
              <span>{t.deleteKeepGuests}</span>
            </li>
            <li>
              <Tick />
              <span>{t.deleteKeepReplies.replace("{n}", String(replyCount))}</span>
            </li>
            <li>
              <Tick />
              <span>{t.deleteKeepManage}</span>
            </li>
          </ul>
        </div>

        <p className="da-goes">{t.deleteWhatGoes}</p>

        <section className="da-keys">
          <p className="da-keys-title">
            <LockIcon />
            {t.saveKeysTitle}
          </p>
          <p className="da-keys-body">{t.saveKeysBody}</p>
          <button type="button" className="sp-ghost da-keys-btn" onClick={copyAll}>
            {copied ? t.copyAllLinksDone : t.copyAllLinks.replace("{n}", n)}
          </button>
        </section>

        <button type="button" className="ag-google da-cancel" onClick={onCancel}>
          {t.cancel}
        </button>
        {/* Asymmetric on purpose: cancel is the wide control, deleting is a
            line of text. Red appears here only as a text colour. */}
        <div className="ag-back">
          <button type="button" className="da-confirm" onClick={onConfirm}>
            {t.deleteAccount}
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
