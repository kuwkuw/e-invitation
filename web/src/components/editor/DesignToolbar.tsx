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
  /** AI background layer (adr-009); the tab is hidden without a handler
   *  and for the minimal palette (excluded from backgrounds). */
  background?: BackgroundRef | null;
  backgroundBusy?: boolean;
  onBackgroundAdd?: () => void;
  onBackgroundRemove?: () => void;
  /** What the «Конверт» tab shows: the envelope a guest opens first, with
   *  the invitation's title and the hosts' seal. */
  envelope: { title: string; monogram: string; hasHosts: boolean };
}

type Tab = "palette" | "typography" | "layout" | "envelope" | "background";

// Mirrors the ::before content in styles.css.
const ORNAMENT_GLYPHS: Record<DesignTokens["ornament"], string> = {
  none: "—",
  floral: "✿",
  geometric: "◆",
  sparkle: "✦",
};

/**
 * The editor's design picker as a strip of underlined tabs under the card
 * (adr-019 §7.3; adr-018 §4 before it).
 *
 * Replaces four labelled rows stacked above the card, which cost roughly a
 * third of a phone screen before the invitation got any. Pressing a tab raises
 * a sheet; pressing it again closes it. The sheet stays open after a choice so
 * the host can try the next one without re-opening.
 *
 * They are drawn as tabs and built as disclosures (`aria-expanded`), because
 * that is how they behave: none is open at rest, and a second press closes
 * the sheet. ARIA's tab pattern always has one panel showing, so `role="tab"`
 * would announce something that isn't true.
 *
 * Five, as adr-019 §7.3 names them. «Макет» holds composition and ornament
 * together: six tabs don't fit a 360 px phone in English, and an ornament is
 * a layout choice. «Конверт» shows the envelope a guest opens first and asks
 * nothing, because the monogram override is deferred (§9.2).
 *
 * The swatches carry `palette-*`, so their colours track styles.css without
 * duplicating a value here. That class also shadows `--ink` on the swatch
 * itself, which is why its selected ring reads `--ui-ink` (styles.css).
 */
export function DesignToolbar({
  design,
  labels,
  onChange,
  background,
  backgroundBusy,
  onBackgroundAdd,
  onBackgroundRemove,
  envelope,
}: Props) {
  const [open, setOpen] = useState<Tab | null>(null);
  const showBackground = Boolean(onBackgroundAdd) && design.palette !== "minimal";

  const tabs: { id: Tab; label: string }[] = [
    { id: "palette", label: labels.palette },
    { id: "typography", label: labels.typography },
    { id: "layout", label: labels.layoutTab },
    { id: "envelope", label: labels.envelope },
    ...(showBackground ? [{ id: "background" as Tab, label: labels.background }] : []),
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
        <DesignSheet title={labels.layoutTab}>
          <div className="cc-design-row" role="group" aria-label={labels.layout}>
            <div className="cc-design-row-title">{labels.layout}</div>
            <div className="cc-design-sheet-body">
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
            </div>
          </div>
          <div className="cc-design-row" role="group" aria-label={labels.ornament}>
            <div className="cc-design-row-title">{labels.ornament}</div>
            <div className="cc-design-sheet-body">
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
            </div>
          </div>
        </DesignSheet>
      )}

      {open === "envelope" && (
        <DesignSheet title={labels.envelope}>
          {/* A picture of the guest page's living envelope (.gr-env-*), so it
              is aria-hidden and the line under it says what it shows. No
              input: the monogram override is deferred (adr-019 §9.2). */}
          <div className="cc-env-still">
            <div className="cc-env" aria-hidden="true">
              <div className="cc-env-flap" />
              <p className="cc-env-to">{envelope.title}</p>
              <span className="seal cc-env-seal">{envelope.monogram}</span>
            </div>
            <p className="cc-env-note">
              {envelope.hasHosts ? labels.envelopeNote : labels.envelopeNoHosts}
            </p>
          </div>
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

      {/* No aria-label on the group: it would announce the whole strip as
          "Palette". Each tab is self-describing by its own text. */}
      <div className="cc-tabs" role="group">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cc-tab${open === tab.id ? " on" : ""}`}
            aria-expanded={open === tab.id}
            onClick={() => setOpen((cur) => (cur === tab.id ? null : tab.id))}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
