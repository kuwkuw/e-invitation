import type { GalleryExample } from "../../gallery";
import type { DesignTokens } from "../../types";
import { InvitationPreview } from "../InvitationPreview";

/** One ready-to-use invitation and its call to action.
 *
 *  Exactly one filled accent per example (adr-017 §2) — the rule adr-010 §3
 *  set for the share panel: the card is the content, and `gl-use` is the only
 *  thing on it asking to be pressed.
 *
 *  The call to action is an `<a href>`, never a `<Link>`. A crawler needs a
 *  real edge to follow, and a full page load is what makes `?sample=`
 *  reload-safe and pasteable.
 *
 *  The card sits on the guest page's deckled mat (adr-019 §11), so a host
 *  choosing one sees it as a guest will. The mat wraps the card and never sits
 *  on it (§3); `.gl-mat` casts its shadow, which the mat's own clip would cut
 *  off. `prerender.ts` writes the same markup for crawlers. */
export function ExampleCard({
  example,
  design,
  useLabel,
}: {
  example: GalleryExample;
  design: DesignTokens;
  useLabel: string;
}) {
  return (
    <article className="gl-example">
      <div className="gl-mat">
        <div className="deckle">
          <InvitationPreview copy={example.copy} design={design} />
        </div>
      </div>
      <div className="gl-example-foot">
        <div>
          <div className="gl-example-style">{example.style}</div>
          <div className="gl-example-note">{example.styleNote}</div>
        </div>
        <a className="gl-use" href={`/create?sample=${encodeURIComponent(example.id)}`}>
          {useLabel}
        </a>
      </div>
    </article>
  );
}
