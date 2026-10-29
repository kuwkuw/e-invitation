import { MAX_GUESTS, MIN_GUESTS, type useRsvpForm } from "../../hooks/useRsvpForm";
import type { GuestStrings } from "../../i18n";
import { CheckIcon, CrossIcon, MinusIcon, PlusIcon, QuestionIcon, SpinnerIcon } from "./icons";

interface Props {
  form: ReturnType<typeof useRsvpForm>;
  t: GuestStrings;
}

/** The reply card (adr-019 §5.3): «Ви з нами?», name, yes/no on tactile
 *  tiles, a party size only after a yes, and the note as a wish to the hosts.
 *  The whole form is visually locked while sending so a double submit can't
 *  race.
 *
 *  «Ще не знаю» (§9.1) is the third radio in the same group, on a quieter row
 *  of its own beneath yes and no rather than a third equal tile beside them.
 *  Three don't fit a 360 px phone at this size, and the question is still
 *  «Ви з нами?»: an equal third tile is how a maybe becomes a soft no. */
export function RsvpForm({ form, t }: Props) {
  return (
    <section className="gr-card">
      <form onSubmit={form.submit}>
        <div className={form.sending ? "gr-lock" : undefined}>
          <h2 id="rsvp-title" className="gr-reply-title">
            {t.replyTitle}
          </h2>

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

          <div className="gr-tiles" role="radiogroup" aria-labelledby="rsvp-title">
            <button
              type="button"
              className={`gr-tile${form.answer === "yes" ? " active" : ""}`}
              role="radio"
              aria-checked={form.answer === "yes"}
              onClick={() => form.setAnswer("yes")}
            >
              <CheckIcon size={18} width={form.answer === "yes" ? 2.4 : 2.2} />
              {t.yes}
            </button>
            <button
              type="button"
              className={`gr-tile decline${form.answer === "no" ? " active" : ""}`}
              role="radio"
              aria-checked={form.answer === "no"}
              onClick={() => form.setAnswer("no")}
            >
              <CrossIcon size={16} />
              {t.no}
            </button>
            <button
              type="button"
              className={`gr-tile maybe${form.answer === "maybe" ? " active" : ""}`}
              role="radio"
              aria-checked={form.answer === "maybe"}
              onClick={() => form.setAnswer("maybe")}
            >
              <QuestionIcon />
              {t.maybe}
            </button>
          </div>

          {form.answer === "yes" && (
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

          {form.submitError && (
            <p className="error">{form.submitError === "limited" ? t.limited : t.error}</p>
          )}
        </div>

        <button className="gr-submit" type="submit" disabled={!form.canSubmit}>
          {form.sending && <SpinnerIcon />}
          {form.sending ? t.sending : t.send}
        </button>
      </form>
    </section>
  );
}
