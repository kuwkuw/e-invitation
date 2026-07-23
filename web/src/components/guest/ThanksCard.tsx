import type { GuestStrings } from "../../i18n";
import { pluralForm } from "../../plural";
import { CheckIcon, HeartIcon, Twinkle } from "./icons";

interface Props {
  attending: boolean;
  guestsCount: number;
  onChangeAnswer: () => void;
  t: GuestStrings;
}

/** Confirmation shown in place of the form once an answer is recorded. The
 *  celebratory badge is reserved for a yes; a decline gets a quiet one. */
export function ThanksCard({ attending, guestsCount, onChangeAnswer, t }: Props) {
  return (
    <section className="gr-card gr-thanks">
      {attending ? (
        <div className="gr-badge-wrap gr-accent" aria-hidden="true">
          <div className="gr-badge-halo" />
          <div className="gr-badge">
            <CheckIcon size={34} color="#ffffff" width={2.6} />
          </div>
          <Twinkle className="gr-tw" style={{ top: -4, right: 2, color: "#d98a4f" }} size={16} />
          <Twinkle
            className="gr-tw"
            style={{ bottom: 2, left: -6, color: "#c98a3e", animationDelay: "0.6s" }}
            size={12}
          />
          <Twinkle
            className="gr-tw"
            style={{ top: 14, left: -10, color: "#b3592e", animationDelay: "1.1s" }}
            size={9}
          />
        </div>
      ) : (
        <div className="gr-badge-wrap" aria-hidden="true">
          <div className="gr-badge gr-badge-muted">
            <HeartIcon />
          </div>
        </div>
      )}
      <h2 className="gr-thanks-title">{attending ? t.thanksTitle : t.declinedTitle}</h2>
      <p className="gr-thanks-body">
        {t.thanksSent}
        <br />
        {attending ? t.thanksGlad : t.declinedSorry}
      </p>
      <div className={`gr-pill${attending ? "" : " muted"}`}>
        {attending && <CheckIcon size={16} color="#b3592e" width={2.4} />}
        {attending
          ? `${t.attendingPill} · ${guestsCount} ${pluralForm(guestsCount, t.guestForms)}`
          : t.declinedPill}
      </div>
      <button type="button" className="gr-change" onClick={onChangeAnswer}>
        {t.changeAnswer}
      </button>
    </section>
  );
}
