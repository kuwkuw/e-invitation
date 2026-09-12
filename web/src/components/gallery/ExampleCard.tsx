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
 *  reload-safe and pasteable. */
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
      <InvitationPreview copy={example.copy} design={design} />
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
