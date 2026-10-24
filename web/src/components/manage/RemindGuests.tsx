import { useCopyLink } from "../../hooks/useCopyLink";
import type { ManageStrings } from "../../i18n";
import { LinkIcon } from "./icons";

/** «Нагадати гостям» (adr-019 §8.3): copies the public link, for the host to
 *  send on to whoever hasn't answered. It is the one control here that rhymes
 *  with the accent, because the accent means that link (adr-010 §3), and even
 *  so it is bordered, not filled: this page's job is reading replies. The
 *  native share sheet stays the editor's (FR-3.6).
 *
 *  Rendered only once someone has replied. Before that, the empty state's
 *  share row already is this action. */
export function RemindGuests({ url, t }: { url: string; t: ManageStrings }) {
  const { copied, copy } = useCopyLink(url);

  return (
    <button type="button" className="hm-remind" onClick={copy} aria-live="polite">
      <LinkIcon />
      {copied ? t.remindCopied : t.remindGuests}
    </button>
  );
}
