import type { GuestStrings } from "../../i18n";
import { pluralForm } from "../../plural";
import { CheckIcon, LinkIcon } from "./icons";

interface Props {
  attending: boolean;
  guestsCount: number;
  onChangeAnswer: () => void;
  /** Passing the link on, offered after a yes only. */
  onShare: () => void;
  copied: boolean;
  t: GuestStrings;
}

/** Shown in place of the form once an answer is recorded (adr-019 §5.3): the
 *  seal turns into a ✓, in the accent for a yes and muted for a no, with copy
 *  matched to the answer. «Змінити відповідь» keeps FR-4.4's re-submit model. */
export function ThanksCard({ attending, guestsCount, onChangeAnswer, onShare, copied, t }: Props) {
  return (
    <section className="gr-card gr-thanks">
      <div className={`seal gr-thanks-seal${attending ? "" : " muted"}`} aria-hidden="true">
        <CheckIcon size={30} width={2.4} />
      </div>
      <h2 className="gr-thanks-title">{attending ? t.thanksTitle : t.declinedTitle}</h2>
      <p className="gr-thanks-body">
        {t.thanksSent}
        <br />
        {attending ? t.thanksGlad : t.declinedSorry}
      </p>
      <div className={`gr-pill${attending ? "" : " muted"}`}>
        {attending && <CheckIcon size={16} width={2.4} />}
        {attending
          ? `${t.attendingPill} · ${guestsCount} ${pluralForm(guestsCount, t.guestForms)}`
          : t.declinedPill}
      </div>
      {attending && (
        <button type="button" className="gr-quiet-action gr-thanks-share" onClick={onShare}>
          <LinkIcon />
          {copied ? t.linkCopied : t.share}
        </button>
      )}
      <button type="button" className="gr-change" onClick={onChangeAnswer}>
        {t.changeAnswer}
      </button>
    </section>
  );
}
