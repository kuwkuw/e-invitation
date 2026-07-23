import type { UiStrings } from "../../i18n";
import type { CopyField, DesignTokens, Invitation } from "../../types";
import { DesignControls } from "../DesignControls";
import { InvitationPreview } from "../InvitationPreview";
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
        <DesignControls
          design={invitation.design}
          labels={t.design}
          onChange={onDesignChange}
          background={invitation.background}
          backgroundBusy={backgroundBusy}
          onBackgroundAdd={onBackgroundAdd}
          onBackgroundRemove={onBackgroundRemove}
        />
        <InvitationPreview
          copy={invitation.copy}
          design={invitation.design}
          background={invitation.background}
          activeField={activeField}
          onFieldClick={onFieldClick}
        />
      </div>
    </section>
  );
}
