import type { KeyboardEvent } from "react";
import type { BackgroundRef, CopyField, DesignTokens, InvitationCopy } from "../types";

interface Props {
  copy: InvitationCopy;
  design: DesignTokens;
  /** Optional AI background layer (adr-009); ignored for the minimal palette. */
  background?: BackgroundRef | null;
  /** When set, copy fields become tappable and the active one is highlighted. */
  activeField?: CopyField | null;
  onFieldClick?: (field: CopyField) => void;
}

// Deterministic renderer: design tokens map 1:1 to CSS classes defined in
// styles.css. No model output is ever interpreted as markup or styles — the
// background is an opaque server-issued asset id turned into our own URL.
export function InvitationPreview({ copy, design, background, activeField, onFieldClick }: Props) {
  const classes = [
    "inv",
    `palette-${design.palette}`,
    `type-${design.typography}`,
    `layout-${design.layout}`,
    `ornament-${design.ornament}`,
  ].join(" ");

  function fieldProps(field: CopyField, base: string) {
    if (!onFieldClick) return { className: base };
    return {
      className: `${base} inv-hit${activeField === field ? " inv-hit-active" : ""}`,
      onClick: () => onFieldClick(field),
      role: "button" as const,
      tabIndex: 0,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") onFieldClick(field);
      },
    };
  }

  const content = (
    <>
      <div className="inv-ornament" aria-hidden="true" />
      <h2 {...fieldProps("title", "inv-title")}>{copy.title}</h2>
      <p {...fieldProps("greeting", "inv-greeting")}>{copy.greeting}</p>
      <p {...fieldProps("body", "inv-body")}>{copy.body}</p>
      <p {...fieldProps("details_line", "inv-details")}>{copy.details_line}</p>
      <p {...fieldProps("rsvp_prompt", "inv-rsvp")}>{copy.rsvp_prompt}</p>
      <p {...fieldProps("closing", "inv-closing")}>{copy.closing}</p>
    </>
  );

  // Background composition per the DS card-background spec (adr-009):
  // minimal is excluded; split confines the image to a side panel with the
  // text panel solid; other layouts get image + palette-tinted scrim under
  // the content. No background = exactly the pre-adr-009 card.
  const bgUrl =
    background && design.palette !== "minimal" ? `/api/backgrounds/${background.id}` : null;

  if (bgUrl && design.layout === "split") {
    return (
      <div className={`${classes} inv-panelbg`}>
        <img className="inv-panel-img" src={bgUrl} alt="" aria-hidden="true" />
        <div className="inv-panel-content">{content}</div>
      </div>
    );
  }

  return (
    <div className={classes}>
      {bgUrl && (
        <>
          <img className="inv-bg" src={bgUrl} alt="" aria-hidden="true" />
          <div className="inv-scrim" aria-hidden="true" />
        </>
      )}
      {content}
    </div>
  );
}
