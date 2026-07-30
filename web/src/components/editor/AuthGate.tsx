import type { GateState } from "../../hooks/usePublishing";
import type { AuthStrings } from "../../i18n";

/**
 * The sign-in gate (adr-014 §2, DS `templates/auth-gate`).
 *
 * It is deliberately **the first frame of the share sheet**, not a screen of
 * its own: same container, same anchor, same rounded top edge the links will
 * appear in a second later. The invitation stays visible behind a scrim,
 * because that is the thing that makes interrupting a committed host
 * tolerable. Only the contents change between states.
 *
 * The two rejected alternatives are recorded in `AuthGateSpec`: a separate
 * `/signin` route (the invitation disappears, and the host returns from Google
 * to a page *about authentication*), and a state inside the Publish button
 * (nowhere to put the "why" line, and `declined`/`failed` have nowhere to go
 * at all).
 */
export function AuthGate({
  state,
  draftSaved,
  errorCode,
  onSignIn,
  onDismiss,
  t,
}: {
  state: GateState;
  draftSaved: boolean;
  errorCode: string | null;
  onSignIn: () => void;
  onDismiss: () => void;
  t: AuthStrings;
}) {
  return (
    <div className="ag-scrim">
      <div className="ag-sheet" role="dialog" aria-modal="true" aria-label={t.gateTitle}>
        <div className="ag-grab" />
        {state === "returning" ? <Returning t={t} /> : null}
        {state === "prompt" || state === "redirecting" ? (
          <Prompt state={state} onSignIn={onSignIn} onDismiss={onDismiss} t={t} />
        ) : null}
        {state === "declined" || state === "failed" ? (
          <Outcome
            state={state}
            draftSaved={draftSaved}
            errorCode={errorCode}
            onSignIn={onSignIn}
            onDismiss={onDismiss}
            t={t}
          />
        ) : null}
      </div>
    </div>
  );
}

function Prompt({
  state,
  onSignIn,
  onDismiss,
  t,
}: {
  state: "prompt" | "redirecting";
  onSignIn: () => void;
  onDismiss: () => void;
  t: AuthStrings;
}) {
  const leaving = state === "redirecting";
  return (
    <>
      <h2 className="ag-title">{t.gateTitle}</h2>
      <p className="ag-why">{t.gateWhy}</p>
      {leaving ? (
        // The button becomes a waiting row *in place*, so the sheet does not
        // jump at the moment the browser is about to leave.
        <div className="ag-waiting">
          <Spinner />
          {t.redirecting}
        </div>
      ) : (
        <button type="button" className="ag-google" onClick={onSignIn}>
          <GoogleMark />
          {t.continueWithGoogle}
        </button>
      )}
      <div className="ag-note">
        {leaving ? <InfoIcon /> : <MailIcon />}
        <span>{leaving ? t.redirectingNote : t.dataNote}</span>
      </div>
      <div className="ag-back">
        <button
          type="button"
          className={`ag-textbtn${leaving ? " ag-textbtn-off" : ""}`}
          onClick={onDismiss}
          disabled={leaving}
        >
          {t.backToEditing}
        </button>
      </div>
    </>
  );
}

/** The state that should barely exist: the host is back, signed in, and the
 *  publish is already in flight. Not one word about authentication — what they
 *  see is the share panel being born, skeletons in the final positions. */
function Returning({ t }: { t: AuthStrings }) {
  return (
    <>
      <div className="ag-progress">
        <div className="ag-progress-fill" />
      </div>
      <div className="ag-returning-head">
        <Spinner />
        <h2 className="ag-title ag-title-inline">{t.returningTitle}</h2>
      </div>
      <p className="ag-why">{t.returningNote}</p>
      <div className="ag-skeleton-label" />
      <div className="ag-skeleton-link" />
      <div className="ag-skeleton-primary" />
      <div className="ag-skeleton-divider" />
      <div className="ag-skeleton-manage" />
    </>
  );
}

function Outcome({
  state,
  draftSaved,
  errorCode,
  onSignIn,
  onDismiss,
  t,
}: {
  state: "declined" | "failed";
  draftSaved: boolean;
  errorCode: string | null;
  onSignIn: () => void;
  onDismiss: () => void;
  t: AuthStrings;
}) {
  const failed = state === "failed";
  return (
    <>
      {failed ? (
        <div className="ag-returning-head">
          <span className="ag-fail-icon">
            <AlertIcon />
          </span>
          <h2 className="ag-title ag-title-inline">{t.failedTitle}</h2>
        </div>
      ) : (
        // No icon, no red, and the word "error" appears nowhere: the host
        // pressed cancel, which is a choice and not a fault.
        <h2 className="ag-title">{t.declinedTitle}</h2>
      )}
      <p className="ag-why">{failed ? t.failedBody : t.declinedBody}</p>
      {draftSaved && (
        <div className="ag-draft">
          <CheckIcon />
          <span>{t.draftSaved}</span>
        </div>
      )}
      {failed ? (
        // An accent-filled retry, because retrying really is the useful thing.
        <button type="button" className="ag-retry" onClick={onSignIn}>
          <RetryIcon />
          {t.tryAgain}
        </button>
      ) : (
        <button type="button" className="ag-google" onClick={onSignIn}>
          <GoogleMark />
          {t.tryAgain}
        </button>
      )}
      <div className="ag-back">
        {/* On `declined` this is the primary action — the host just said no. */}
        <button
          type="button"
          className={`ag-textbtn${failed ? "" : " ag-textbtn-strong"}`}
          onClick={onDismiss}
        >
          {t.backToEditing}
        </button>
      </div>
      {failed && errorCode && <p className="ag-code">{t.errorCode.replace("{code}", errorCode)}</p>}
    </>
  );
}

function Spinner() {
  return (
    <svg className="ag-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#e0d9cb" strokeWidth="2.6" />
      <path d="M21 12a9 9 0 00-9-9" stroke="#b3592e" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Google's official four-colour mark. Never recoloured to match the chrome —
 *  that is a brand rule, not a design preference. */
function GoogleMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="#b0a99a" strokeWidth="1.7" />
      <path d="M4.5 8l7.5 5.5L19.5 8" stroke="#b0a99a" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 8v5M12 16.2v.1" stroke="#b0a99a" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8.6" stroke="#b0a99a" strokeWidth="1.6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="#3d6b47"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 7.5v6M12 16.8v.1" stroke="#a83f3f" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0113.7-5.6M20 12a8 8 0 01-13.7 5.6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 3v4h-4M6 21v-4h4"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
