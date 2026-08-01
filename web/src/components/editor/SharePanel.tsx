import { useState } from "react";
import { manageUrl, shareUrl } from "../../hooks/usePublishing";
import type { UiStrings } from "../../i18n";
import type { PublishResult } from "../../types";
import { CheckIcon, LinkIcon, LockIcon, MailIcon, MailOffIcon } from "./icons";

interface Props {
  published: PublishResult;
  onCopyLink: () => void;
  copied: boolean;
  onCopyManageLink: () => void;
  manageCopied: boolean;
  /** A signed-in host's account holds the manage link for them (adr-014 §5),
   *  so the block collapses — see the component comment. */
  signedIn?: boolean;
  manageShown?: boolean;
  onToggleManage?: () => void;
  /** Reply notifications (adr-015 §7). Absent `notifyEmail` — an unconfigured
   *  deployment or a signed-out host — renders no line at all. */
  notifyEmail?: string | null;
  notifyEnabled?: boolean;
  onToggleNotify?: () => void;
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
 *
 * For a signed-in host the block collapses to one row behind "Show" (DS
 * `ShareSignedIn`). That block had been carrying two different messages in one
 * piece of copy — *keep this safe, it is your only way back* and *do not send
 * this to anyone*. An account makes the first untrue and leaves the second
 * exactly as true, so they are separated: the keeping moves up into a quiet
 * account line, and the warning stays word-for-word where it was.
 *
 * Collapsing is not a quieter warning. The warning exists to stop the wrong
 * link being copied, and collapsed there is nothing to copy — no link text, no
 * button, no selection. The risk appears with the copy button, and so does the
 * warning. **The copy button never exists on screen without it**: every state,
 * every width, both languages.
 */
export function SharePanel({
  published,
  onCopyLink,
  copied,
  onCopyManageLink,
  manageCopied,
  signedIn = false,
  manageShown = false,
  onToggleManage,
  notifyEmail = null,
  notifyEnabled = true,
  onToggleNotify,
  t,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const guestUrl = shareUrl(published.id);
  // One string per language, split at render, so translators see a whole
  // sentence and the address still gets its own treatment.
  const [notifyOnBefore, notifyOnAfter] = t.auth.notifyOn.split("{email}");
  // Signed out, the block is always open: there it really is the only key, and
  // its weight is earned.
  const manageOpen = !signedIn || manageShown;

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

      {signedIn && (
        <p className="sp-account-note">
          <CheckIcon />
          <span>{t.auth.savedToAccount}</span>
        </p>
      )}

      {/* adr-015 §7: disclosed where it is caused. A host learns that replies
          will be emailed at the moment they publish, with the switch beside
          the sentence — not from the first email, and not from a settings
          screen this app does not have. Deliberately the same quiet treatment
          as the account note above and the same text-button as Show/Hide: the
          panel's hierarchy exists to keep the manage link subordinate to the
          share link (adr-010 §3), and a third control competing for attention
          would spend that. */}
      {signedIn && notifyEmail && (
        <div className="sp-notify">
          <div className="sp-notify-row">
            <span className="sp-notify-icon">{notifyEnabled ? <MailIcon /> : <MailOffIcon />}</span>
            <p className="sp-notify-text">
              {notifyEnabled ? (
                // Split rather than interpolated: the address is set in its own
                // weight, and it must not be a link — it is a fact about where
                // mail goes, not an address to click.
                <>
                  {notifyOnBefore}
                  <span className="sp-notify-email">{notifyEmail}</span>
                  {notifyOnAfter}
                </>
              ) : (
                t.auth.notifyOff
              )}
            </p>
          </div>
          <div className="sp-notify-action">
            <button type="button" className="sp-notify-toggle" onClick={onToggleNotify}>
              {notifyEnabled ? t.auth.notifyTurnOff : t.auth.notifyTurnOn}
            </button>
          </div>
        </div>
      )}

      {signedIn && !manageOpen ? (
        <button type="button" className="sp-manage-collapsed" onClick={onToggleManage}>
          <LockIcon />
          <span className="sp-manage-collapsed-label">{t.manageLinkLabel}</span>
          <span className="sp-manage-collapsed-action">{t.auth.showManage}</span>
        </button>
      ) : (
        <section className="sp-manage">
          <p className="sp-manage-label">
            <LockIcon />
            {t.manageLinkLabel}
            {signedIn && (
              <button type="button" className="sp-manage-hide" onClick={onToggleManage}>
                {t.auth.hideManage}
              </button>
            )}
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
      )}

      <a className="sp-responses-link" href={`/manage/${published.id}`}>
        {t.viewResponses}
      </a>
    </div>
  );
}
