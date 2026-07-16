import {
  LAYOUTS,
  ORNAMENTS,
  PALETTES,
  TYPOGRAPHIES,
  type DesignTokens,
} from "../types";
import type { DesignStrings } from "../i18n";

interface Props {
  design: DesignTokens;
  labels: DesignStrings;
  onChange: (patch: Partial<DesignTokens>) => void;
}

// Preview glyphs for ornament options; mirrors the ::before content in styles.css.
const ORNAMENT_GLYPHS: Record<DesignTokens["ornament"], string> = {
  none: "—",
  floral: "✿",
  geometric: "◆",
  sparkle: "✦",
};

// Inline design picker: every control swaps one token and the deterministic
// renderer re-applies instantly — no LLM round-trip.
export function DesignControls({ design, labels, onChange }: Props) {
  return (
    <div className="design-controls">
      <div className="design-group" role="group" aria-label={labels.palette}>
        <span className="design-label">{labels.palette}</span>
        <div className="design-options">
          {PALETTES.map((palette) => (
            <button
              key={palette}
              // palette-* classes define --bg/--accent, so the swatch colors
              // always track styles.css without duplicating any values here.
              className={`swatch palette-${palette}${design.palette === palette ? " active" : ""}`}
              title={labels.values[palette]}
              aria-label={labels.values[palette]}
              aria-pressed={design.palette === palette}
              onClick={() => onChange({ palette })}
            >
              <span className="swatch-dot" />
            </button>
          ))}
        </div>
      </div>

      <div className="design-group" role="group" aria-label={labels.typography}>
        <span className="design-label">{labels.typography}</span>
        <div className="design-options">
          {TYPOGRAPHIES.map((typography) => (
            <button
              key={typography}
              className={`design-option type-${typography} font-sample${design.typography === typography ? " active" : ""}`}
              title={labels.values[typography]}
              aria-pressed={design.typography === typography}
              onClick={() => onChange({ typography })}
            >
              Aa
            </button>
          ))}
        </div>
      </div>

      <div className="design-group" role="group" aria-label={labels.layout}>
        <span className="design-label">{labels.layout}</span>
        <div className="design-options">
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              className={`design-option${design.layout === layout ? " active" : ""}`}
              aria-pressed={design.layout === layout}
              onClick={() => onChange({ layout })}
            >
              {labels.values[layout]}
            </button>
          ))}
        </div>
      </div>

      <div className="design-group" role="group" aria-label={labels.ornament}>
        <span className="design-label">{labels.ornament}</span>
        <div className="design-options">
          {ORNAMENTS.map((ornament) => (
            <button
              key={ornament}
              className={`design-option${design.ornament === ornament ? " active" : ""}`}
              title={labels.values[ornament]}
              aria-pressed={design.ornament === ornament}
              onClick={() => onChange({ ornament })}
            >
              {ORNAMENT_GLYPHS[ornament]} {labels.values[ornament]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
