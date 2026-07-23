import type { GuestStrings } from "../../i18n";
import { EmptyEnvelopeIcon } from "./icons";

/** Dead or unreachable share link. `body` distinguishes "no such invitation"
 *  from "the request failed" — the guest can act on the second one. */
export function GuestNotFound({ body, t }: { body: string; t: GuestStrings }) {
  return (
    <div className="gr-page gr-notfound">
      <div className="gr-notfound-icon" aria-hidden="true">
        <EmptyEnvelopeIcon />
      </div>
      <h1 className="gr-notfound-title">{t.notFoundTitle}</h1>
      <p className="gr-notfound-body">{body}</p>
      <p className="gr-notfound-hint">{t.notFoundHint}</p>
      <div className="gr-brand">INVITO</div>
    </div>
  );
}
