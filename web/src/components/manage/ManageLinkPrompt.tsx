import { type ReactNode, useState } from "react";
import type { ManageStrings } from "../../i18n";

interface Props {
  icon: ReactNode;
  title: string;
  body: string;
  /** Closing reassurance — the difference between "you lost access" and
   *  "we just need the link again". */
  hint: string;
  onSubmit: (input: string) => boolean;
  t: ManageStrings;
}

/** Shared by the no-token and invalid-token states. They differ only in
 *  wording; the way out is identical, so the form is too (adr-010 §7). */
export function ManageLinkPrompt({ icon, title, body, hint, onSubmit, t }: Props) {
  const [value, setValue] = useState("");
  const [rejected, setRejected] = useState(false);

  return (
    <form
      className="hm-card hm-prompt"
      onSubmit={(event) => {
        event.preventDefault();
        setRejected(!onSubmit(value));
      }}
    >
      <span className="hm-state-icon">{icon}</span>
      <h1 className="hm-state-title">{title}</h1>
      <p className="hm-state-body">{body}</p>

      <input
        className="hm-paste"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setRejected(false);
        }}
        placeholder={t.pastePlaceholder}
        aria-label={t.pastePlaceholder}
        aria-invalid={rejected || undefined}
      />
      {rejected && <p className="hm-reject">{t.pasteInvalid}</p>}
      <button type="submit" className="hm-primary">
        {t.openDashboard}
      </button>
      <p className="hm-state-hint">{hint}</p>
    </form>
  );
}
