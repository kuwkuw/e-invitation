import { useState } from "react";
import { manageUrl, shareUrl } from "../../hooks/usePublishing";
import type { UiStrings } from "../../i18n";
import type { PublishResult } from "../../types";
import { CheckIcon, LinkIcon, LockIcon } from "./icons";

interface Props {
  published: PublishResult;
  onCopyLink: () => void;
  copied: boolean;
  onCopyManageLink: () => void;
  manageCopied: boolean;
  t: UiStrings;
}

/**
 * Post-publish panel: two links that must never be confused for each other.
 *
 * The public `/i/:id` link is the reason the panel exists — first, with the
 * one filled accent button. The manage link is the host's only credential:
 * below a divider, in its own warm "sensitive" block, masked by default, with
 * a quiet outline button and an explicit warning. There is no server-side
 * protection against a host pasting the wrong one into a group chat, so this
 * hierarchy is the safeguard (adr-010 §3, "share-panel" DS template).
 */
export function SharePanel({
  published,
  onCopyLink,
  copied,
  onCopyManageLink,
  manageCopied,
  t,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const guestUrl = shareUrl(published.id);

  return (
    <div className="cc-share-panel">
      <div className="sp-head">
        <span className="sp-check">
          <CheckIcon />
        </span>
        <h2 className="sp-title">{t.publishedTitle}</h2>
        <span className="sp-version">
          {t.publishedVersion.replace("{n}", String(published.version))}
        </span>
      </div>
      <p className="sp-subtitle">{t.publishedSubtitle}</p>

      <p className="sp-label">
        {t.guestLinkLabel}
        <span className="sp-badge">{t.guestLinkBadge}</span>
      </p>
      <div className="sp-link">
        <LinkIcon />
        <span className="sp-link-value">{guestUrl}</span>
      </div>
      <button type="button" className="sp-primary" onClick={onCopyLink}>
        {copied ? t.copied : t.copyLink}
      </button>
      <p className="sp-hint">{t.shareHint}</p>

      <div className="sp-divider" />

      <section className="sp-manage">
        <p className="sp-manage-label">
          <LockIcon />
          {t.manageLinkLabel}
        </p>
        <p className="sp-manage-warning">{t.manageLinkWarning}</p>
        <div className="sp-manage-row">
          {/* Masked by default so it can't be swept up by a stray select-all
              or an absent-minded copy. Revealing is a deliberate act. */}
          <span className="sp-manage-value">
            {revealed
              ? manageUrl(published.id, published.manage_token)
              : `${window.location.host}/manage/${t.manageLinkMasked}`}
          </span>
          <button type="button" className="sp-ghost" onClick={onCopyManageLink}>
            {t.copyManageLink}
          </button>
        </div>
        {manageCopied ? (
          <p className="sp-manage-copied">{t.manageLinkCopied}</p>
        ) : (
          !revealed && (
            <button type="button" className="sp-reveal" onClick={() => setRevealed(true)}>
              {t.revealManageLink}
            </button>
          )
        )}
      </section>

      <a className="sp-responses-link" href={`/manage/${published.id}`}>
        {t.viewResponses}
      </a>
    </div>
  );
}
