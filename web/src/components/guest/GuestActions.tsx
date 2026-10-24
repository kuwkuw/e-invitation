import type { GuestStrings } from "../../i18n";
import { ChevronIcon, LinkIcon } from "./icons";

interface Props {
  onShare: () => void;
  shareSubtitle: string;
  t: GuestStrings;
}

/** Post-acceptance: pass the link on. Only shown to guests who said yes.
 *  Calendar and directions moved under the card (adr-019 §5.2). */
export function GuestActions({ onShare, shareSubtitle, t }: Props) {
  return (
    <div className="gr-rows">
      <button type="button" className="gr-row" onClick={onShare}>
        <div className="gr-row-icon">
          <LinkIcon />
        </div>
        <div className="gr-row-text">
          <div className="gr-row-title">{t.share}</div>
          <div className="gr-row-sub">{shareSubtitle}</div>
        </div>
        <ChevronIcon />
      </button>
    </div>
  );
}
