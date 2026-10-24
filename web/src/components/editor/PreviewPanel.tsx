import type { UiStrings } from "../../i18n";
import type { CopyField, DesignTokens, Invitation } from "../../types";
import { InvitationPreview } from "../InvitationPreview";
import { DesignToolbar } from "./DesignToolbar";
import { SparkleIcon } from "./icons";

interface Props {
  invitation: Invitation | null;
  generating: boolean;
  activeField: CopyField | null;
  onFieldClick: (field: CopyField) => void;
  onDesignChange: (patch: Partial<DesignTokens>) => void;
  backgroundBusy: boolean;
  onBackgroundAdd: () => void;
  onBackgroundRemove: () => void;
  t: UiStrings;
}

/** Skeleton while generating, the live card once there's an invitation,
 *  placeholder before the first one. */
export function PreviewPanel({
  invitation,
  generating,
  activeField,
  onFieldClick,
  onDesignChange,
  backgroundBusy,
  onBackgroundAdd,
  onBackgroundRemove,
  t,
}: Props) {
  if (generating) {
    return (
      <section className="cc-preview">
        <div className="cc-skeleton" role="status" aria-label={t.chat.creating}>
          <div className="cc-sk cc-sk-badge" />
          <div className="cc-sk" style={{ width: "72%", height: 22 }} />
          <div className="cc-sk" style={{ width: "46%", height: 12 }} />
          <div className="cc-sk" style={{ width: "92%", height: 10, marginTop: 10 }} />
          <div className="cc-sk" style={{ width: "84%", height: 10 }} />
          <div className="cc-sk" style={{ width: "64%", height: 12, marginTop: 6 }} />
          <div className="cc-sk cc-sk-pill" />
        </div>
      </section>
    );
  }

  if (!invitation) {
    return (
      <section className="cc-preview">
        <div className="cc-placeholder">
          <SparkleIcon size={42} />
          <div>{t.chat.previewPlaceholder}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="cc-preview">
      <div className="cc-preview-inner">
        {/* The card on the deckled mat, as the guest page sets it (.gr-mat,
            adr-019 §7.1), so what the host edits is what the guest opens. The
            mat wraps the card and never sits on it (§3); .cc-mat casts its
            shadow, which the mat's own clip-path would cut off. */}
        <div className="cc-mat">
          <div className="deckle">
            <InvitationPreview
              copy={invitation.copy}
              design={invitation.design}
              background={invitation.background}
              activeField={activeField}
              onFieldClick={onFieldClick}
            />
          </div>
        </div>
        {/* After the card, so it can stick to the pane's bottom: as the first
            child it never pinned and scrolled away with the card. */}
        <DesignToolbar
          design={invitation.design}
          labels={t.design}
          onChange={onDesignChange}
          background={invitation.background}
          backgroundBusy={backgroundBusy}
          onBackgroundAdd={onBackgroundAdd}
          onBackgroundRemove={onBackgroundRemove}
        />
      </div>
    </section>
  );
}
