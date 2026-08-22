import { useFeedback } from "../hooks/useFeedback";
import type { FeedbackStrings } from "../i18n";
import type { FeedbackPage, Language } from "../types";

/**
 * The feedback form (adr-017), as a sheet over whichever page opened it.
 *
 * It borrows the `ag-*` sheet shell rather than inventing a second one: the
 * sign-in gate, the sign-out confirmation and the delete confirmation are all
 * this shape already, and a fourth container would be a new visual idea for no
 * new kind of moment. What it does not borrow is the reassurance frame — there
 * is nothing here to be reassured about, because nothing is being decided.
 *
 * **One field and no chrome around it.** No subject line, no category picker,
 * no rating: a category is a question the host has to answer before they get
 * to the one they came to answer, and a rating at this volume produces a
 * number that means nothing while costing the sentence nobody predicted
 * (adr-017 §1).
 *
 * The identity line is stated **before** sending, in both directions, so
 * whether we can write back is never something a host finds out afterwards.
 * Signed out it offers no sign-in button on purpose: this sheet is often open
 * *because* something went wrong, and answering that with another sign-in
 * prompt is the product arguing with someone trying to tell it something.
 */
export function FeedbackSheet({
  page,
  lang,
  email,
  onClose,
  t,
}: {
  /** Which surface opened it — captured, never asked, and never an invitation
   *  id (adr-017 §3). */
  page: FeedbackPage;
  lang: Language;
  /** The signed-in address, or null when there is none. Null is an ordinary
   *  case here, not a degraded one: sending needs no account. */
  email: string | null;
  onClose: () => void;
  t: FeedbackStrings;
}) {
  const feedback = useFeedback(page, lang);

  return (
    <div className="ag-scrim">
      <div className="ag-sheet" role="dialog" aria-modal="true" aria-label={t.title}>
        <div className="ag-grab" />

        {feedback.status === "sent" ? (
          // The sheet stays open on success rather than closing itself. A form
          // that vanishes leaves the host wondering whether it sent, and this
          // is the one screen in the product with no other confirmation to
          // fall back on — there is no dashboard row and no email receipt.
          <>
            <h2 className="ag-title">{t.thanksTitle}</h2>
            <p className="ag-why">{t.thanksBody}</p>
            <button type="button" className="ag-google" onClick={onClose}>
              {t.close}
            </button>
          </>
        ) : (
          <>
            <h2 className="ag-title">{t.title}</h2>
            <p className="ag-why">{t.intro}</p>

            <textarea
              className="fb-input"
              value={feedback.message}
              onChange={(event) => feedback.setMessage(event.target.value)}
              placeholder={t.placeholder}
              // Matches the server's cap so a long message is stopped by the
              // field rather than by a 400 after the host has written it.
              maxLength={2000}
              rows={5}
              aria-label={t.title}
            />

            <p className="fb-identity">
              {email ? t.signedInAs.replace("{email}", email) : t.anonymous}
            </p>

            {feedback.error && (
              <p className="fb-error" role="alert">
                {feedback.error === "limited" ? t.errorLimited : t.errorGeneric}
              </p>
            )}

            <button
              type="button"
              className="fb-send"
              onClick={() => void feedback.send()}
              disabled={!feedback.canSend}
            >
              {feedback.status === "sending" ? t.sending : t.send}
            </button>
            <div className="ag-back">
              <button type="button" className="ag-textbtn" onClick={onClose}>
                {t.cancel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
