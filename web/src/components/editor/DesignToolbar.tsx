import { useState } from "react";
import type { DesignStrings } from "../../i18n";
import {
  type BackgroundRef,
  type DesignTokens,
  LAYOUTS,
  ORNAMENTS,
  PALETTES,
  TYPOGRAPHIES,
} from "../../types";
import { DesignSheet } from "./DesignSheet";

interface Props {
  design: DesignTokens;
  labels: DesignStrings;
  onChange: (patch: Partial<DesignTokens>) => void;
  /** AI background layer (adr-009); the segment is hidden without a handler
   *  and for the minimal palette (excluded from backgrounds). */
  background?: BackgroundRef | null;
  backgroundBusy?: boolean;
  onBackgroundAdd?: () => void;
  onBackgroundRemove?: () => void;
}

type Segment = "palette" | "typography" | "layout" | "ornament" | "background";

// Mirrors the ::before content in styles.css, same as DesignControls did.
const ORNAMENT_GLYPHS: Record<DesignTokens["ornament"], string> = {
  none: "—",
  floral: "✿",
  geometric: "◆",
  sparkle: "✦",
};

/**
 * The editor's design picker as one segmented bar (adr-018 §4).
 *
 * Replaces four labelled rows stacked above the card, which cost roughly a
 * third of a phone screen before the invitation got any. Pressing a segment
 * raises a sheet; pressing it again closes it. The sheet stays open after a
 * choice so the host can try the next one without re-opening.
 *
 * The swatches still carry `palette-*`, so their colours track styles.css
 * without duplicating a value here — the same property DesignControls had.
 */
export function DesignToolbar({
  design,
  labels,
  onChange,
  background,
  backgroundBusy,
  onBackgroundAdd,
  onBackgroundRemove,
}: Props) {
  const [open, setOpen] = useState<Segment | null>(null);
  const showBackground = Boolean(onBackgroundAdd) && design.palette !== "minimal";

  const segments: { id: Segment; label: string }[] = [
    { id: "palette", label: labels.palette },
    { id: "typography", label: labels.typography },
    { id: "layout", label: labels.layout },
    { id: "ornament", label: labels.ornament },
    ...(showBackground ? [{ id: "background" as Segment, label: labels.background }] : []),
  ];

  return (
    <div className="cc-design">
      {open === "palette" && (
        <DesignSheet title={labels.palette}>
          {PALETTES.map((palette) => (
            <button
              key={palette}
              type="button"
              className={`swatch palette-${palette}${design.palette === palette ? " active" : ""}`}
              aria-label={labels.values[palette]}
              aria-pressed={design.palette === palette}
              onClick={() => onChange({ palette })}
            >
              <span className="swatch-dot" />
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "typography" && (
        <DesignSheet title={labels.typography}>
          {TYPOGRAPHIES.map((typography) => (
            <button
              key={typography}
              type="button"
              className={`design-option type-${typography} font-sample${design.typography === typography ? " active" : ""}`}
              aria-label={labels.values[typography]}
              aria-pressed={design.typography === typography}
              onClick={() => onChange({ typography })}
            >
              Aa
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "layout" && (
        <DesignSheet title={labels.layout}>
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              className={`design-option${design.layout === layout ? " active" : ""}`}
              aria-pressed={design.layout === layout}
              onClick={() => onChange({ layout })}
            >
              {labels.values[layout]}
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "ornament" && (
        <DesignSheet title={labels.ornament}>
          {ORNAMENTS.map((ornament) => (
            <button
              key={ornament}
              type="button"
              className={`design-option${design.ornament === ornament ? " active" : ""}`}
              aria-pressed={design.ornament === ornament}
              onClick={() => onChange({ ornament })}
            >
              {ORNAMENT_GLYPHS[ornament]} {labels.values[ornament]}
            </button>
          ))}
        </DesignSheet>
      )}

      {open === "background" && showBackground && (
        <DesignSheet title={labels.background}>
          {backgroundBusy ? (
            <button type="button" className="design-option" disabled>
              {labels.bgGenerating}
            </button>
          ) : background ? (
            <>
              <button type="button" className="design-option" onClick={onBackgroundAdd}>
                {labels.bgRegenerate}
              </button>
              <button type="button" className="design-option" onClick={onBackgroundRemove}>
                {labels.bgRemove}
              </button>
            </>
          ) : (
            <button type="button" className="design-option" onClick={onBackgroundAdd}>
              {labels.bgAdd}
            </button>
          )}
        </DesignSheet>
      )}

      {/* No aria-label on the group: it would announce the whole toolbar as
          "Palette". Each segment is self-describing by its own text. */}
      <div className="cc-seg glass" role="group">
        {segments.map((seg) => (
          <button
            key={seg.id}
            type="button"
            className={`cc-seg-item${open === seg.id ? " on" : ""}`}
            aria-expanded={open === seg.id}
            onClick={() => setOpen((cur) => (cur === seg.id ? null : seg.id))}
          >
            {seg.label}
          </button>
        ))}
      </div>
    </div>
  );
}
