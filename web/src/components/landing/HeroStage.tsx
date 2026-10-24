import type { DesignTokens, InvitationCopy } from "../../types";
import { InvitationPreview } from "../InvitationPreview";

/**
 * The hero's other half (adr-019 §6.1): the invitation the composer describes,
 * rising out of a kraft envelope on the `--table`, set on the deckled mat as
 * stationery is shown. It rises once the typing ends; under reduced motion it
 * has simply risen (the rules are in styles.css's no-preference block).
 *
 * Decorative, so `aria-hidden`, and left out of the prerendered block for the
 * reason the three-card fan it replaced was: a lot of markup for no reading,
 * and the composer above already says what it shows. The mat's shadow is on
 * `.lp-stage-card`, outside the deckle's clip-path, which would cut it off.
 */
export function HeroStage({
  copy,
  design,
  monogram,
}: {
  copy: InvitationCopy;
  design: DesignTokens;
  monogram: string;
}) {
  return (
    <div className="lp-stage grain" aria-hidden="true">
      <div className="lp-stage-env">
        <div className="lp-stage-card">
          <div className="deckle">
            <InvitationPreview copy={copy} design={design} />
          </div>
        </div>
        <div className="lp-stage-pocket">
          <span className="seal lp-stage-seal">{monogram}</span>
        </div>
      </div>
    </div>
  );
}
