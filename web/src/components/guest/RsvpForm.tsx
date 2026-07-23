import { MAX_GUESTS, MIN_GUESTS, type useRsvpForm } from "../../hooks/useRsvpForm";
import type { GuestStrings } from "../../i18n";
import { CheckIcon, CrossIcon, MinusIcon, PlusIcon, SpinnerIcon } from "./icons";

interface Props {
  form: ReturnType<typeof useRsvpForm>;
  t: GuestStrings;
}

/** The reply card: name, yes/no, party size, optional note. The whole form is
 *  visually locked while sending so a double submit can't race. */
export function RsvpForm({ form, t }: Props) {
  return (
    <section className="gr-card">
      <form onSubmit={form.submit}>
        <div className={form.sending ? "gr-lock" : undefined}>
          <div className="gr-kicker">{t.replyKicker}</div>

          <label className="gr-label" htmlFor="rsvp-name">
            {t.yourName}
          </label>
          <input
            id="rsvp-name"
            className="gr-input"
            value={form.name}
            onChange={(e) => form.setName(e.target.value)}
            placeholder={t.namePlaceholder}
            maxLength={100}
            required
          />

          <div className="gr-question">{t.attendingQuestion}</div>
          <div className="gr-tiles" role="radiogroup" aria-label={t.attendingQuestion}>
            <button
              type="button"
              className={`gr-tile${form.attending === true ? " active" : ""}`}
              role="radio"
              aria-checked={form.attending === true}
              onClick={() => form.setAttending(true)}
            >
              <CheckIcon
                size={18}
                color={form.attending === true ? "#ffffff" : "#b3592e"}
                width={form.attending === true ? 2.4 : 2.2}
              />
              {t.yes}
            </button>
            <button
              type="button"
              className={`gr-tile decline${form.attending === false ? " active" : ""}`}
              role="radio"
              aria-checked={form.attending === false}
              onClick={() => form.setAttending(false)}
            >
              <CrossIcon size={16} color={form.attending === false ? "#ffffff" : "#8d8577"} />
              {t.no}
            </button>
          </div>

          {form.attending === true && (
            <div className="gr-guests">
              <div className="gr-label centered">{t.guestsCount}</div>
              <div className="gr-stepper-wrap">
                <div className="gr-stepper">
                  <button
                    type="button"
                    className="gr-step"
                    aria-label="−"
                    disabled={form.guestsCount <= MIN_GUESTS}
                    onClick={form.decrement}
                  >
                    <MinusIcon />
                  </button>
                  <div className="gr-count">{form.guestsCount}</div>
                  <button
                    type="button"
                    className="gr-step"
                    aria-label="+"
                    disabled={form.guestsCount >= MAX_GUESTS}
                    onClick={form.increment}
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            </div>
          )}

          <label className="gr-label" htmlFor="rsvp-note">
            {t.noteLabel} <span className="gr-optional">{t.noteOptional}</span>
          </label>
          <textarea
            id="rsvp-note"
            className="gr-input gr-note"
            value={form.note}
            onChange={(e) => form.setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            maxLength={500}
            rows={2}
          />

          {form.submitError && <p className="error">{t.error}</p>}
        </div>

        <button className="gr-submit" type="submit" disabled={!form.canSubmit}>
          {form.sending && <SpinnerIcon />}
          {form.sending ? t.sending : t.send}
        </button>
      </form>
    </section>
  );
}
