import { useState } from "react";
import type { ManageStrings } from "../../i18n";
import { EnvelopeIcon } from "./icons";

/** Published, shared, and nobody has answered yet. This host is anxious, so
 *  the state reassures and offers the one useful action — share the link
 *  again — rather than reading as an error. */
export function ManageEmpty({ shareUrl, t }: { shareUrl: string; t: ManageStrings }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="hm-card hm-empty">
      <span className="hm-empty-icon">
        <EnvelopeIcon />
      </span>
      <h2 className="hm-empty-title">{t.emptyTitle}</h2>
      <p className="hm-empty-body">{t.emptyBody}</p>
      <p className="hm-empty-reassure">{t.emptyReassure}</p>

      <p className="hm-share-again">{t.shareAgain}</p>
      <div className="hm-share-row">
        <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
        <button type="button" onClick={copy}>
          {copied ? t.copied : t.copyLink}
        </button>
      </div>
    </section>
  );
}
