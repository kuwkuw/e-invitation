import { useState } from "react";
import { manageUrl, shareUrl } from "../../hooks/usePublishing";
import type { UiStrings } from "../../i18n";
import type { PublishResult } from "../../types";
import { NotifyCheckbox } from "../NotifyCheckbox";
import { CheckIcon, LinkIcon, LockIcon, ShareIcon } from "./icons";

/** A checkbox must have an onChange; the prop is optional on this panel. */
const noop = () => {};

interface Props {
  published: PublishResult;
  onCopyLink: () => void;
  copied: boolean;
  /** Whether this browser can open a native share sheet. False — jsdom, and
   *  every browser without the API — is the panel exactly as it shipped. */
  canShare?: boolean;
  onShare?: () => void;
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
  /** Opt-in, so this defaults to false and the block is an offer rather than a
   *  disclosure (adr-015 §7, amended). This is the moment it belongs at: a
   *  switch a host has to go and find later would leave the feature unused by
   *  everyone who did not think to look for it. */
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
 * hierarchy is the safeguard (adr-010 §3, "share-panel" design-project screens).
 *
 * For a signed-in host the block collapses to one row behind "Show" (design
 * project `ShareSignedIn`). That block had been carrying two different messages in one
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
 *
 * Where the browser can share natively the public block gains a second control
 * and the primary becomes Share. That does not spend the hierarchy: both are
 * the *public* link, above the divider, and the count of filled accents stays
 * one. Copy steps down to an outline in neutral chrome — deliberately not the
 * manage block's warm `.sp-ghost`, so the two never read as a pair.
 */
export function SharePanel({
  published,
  onCopyLink,
  copied,
  canShare = false,
  onShare,
  onCopyManageLink,
  manageCopied,
  signedIn = false,
  manageShown = false,
  onToggleManage,
  notifyEmail = null,
  notifyEnabled = false,
  onToggleNotify,
  t,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const guestUrl = shareUrl(published.id);
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
      {canShare && onShare ? (
        <>
          <button type="button" className="sp-primary" onClick={onShare}>
            <ShareIcon size={17} />
            {t.shareInvitation}
          </button>
          <button type="button" className="sp-secondary" onClick={onCopyLink}>
            {copied ? t.copied : t.copyLink}
          </button>
          <p className="sp-hint">{t.shareInvitationHint}</p>
        </>
      ) : (
        <>
          <button type="button" className="sp-primary" onClick={onCopyLink}>
            {copied ? t.copied : t.copyLink}
          </button>
          <p className="sp-hint">{t.shareHint}</p>
        </>
      )}

      <div className="sp-divider" />

      {signedIn && (
        <p className="sp-account-note">
          <CheckIcon />
          <span>{t.auth.savedToAccount}</span>
        </p>
      )}

      {/* adr-015 §7: asked where it is caused. A host decides whether replies
          are emailed at the moment they publish, not from the first email
          and not from a settings screen this app does not have. It is the
          checkbox the landing footer and the dashboard carry (adr-019 §10),
          and it may stand out where the sentence it replaced could not,
          because the panel's hierarchy counts fills, not affordances
          (adr-010 §3.1): the square spends none, so the public link keeps
          the only filled accent. */}
      {signedIn && notifyEmail && (
        // The envelope that used to carry the state is gone from here: the
        // square carries it now, and two state glyphs in one row would argue
        // with each other. The envelope keeps its job where nothing is
        // pressable, the email footer and the unsubscribe page.
        <div className="sp-notify">
          <NotifyCheckbox
            checked={notifyEnabled}
            onToggle={onToggleNotify ?? noop}
            name={t.auth.notifyOptIn}
            // The address and the scope ride the state row in both states,
            // so a host accepts knowing both, and the scope doesn't vanish
            // once they have. On, it is the dashboard's sentence: this panel
            // is about one event too.
            state={(notifyEnabled ? t.auth.notifyStateOnEvent : t.auth.notifyStateOffer).replace(
              "{email}",
              notifyEmail,
            )}
          />
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
