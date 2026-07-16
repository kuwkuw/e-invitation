import type { KeyboardEvent } from "react";
import type { CopyField, DesignTokens, InvitationCopy } from "../types";

interface Props {
  copy: InvitationCopy;
  design: DesignTokens;
  /** When set, copy fields become tappable and the active one is highlighted. */
  activeField?: CopyField | null;
  onFieldClick?: (field: CopyField) => void;
}

// Deterministic renderer: design tokens map 1:1 to CSS classes defined in
// styles.css. No model output is ever interpreted as markup or styles.
export function InvitationPreview({ copy, design, activeField, onFieldClick }: Props) {
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

  return (
    <div className={classes}>
      <div className="inv-ornament" aria-hidden="true" />
      <h2 {...fieldProps("title", "inv-title")}>{copy.title}</h2>
      <p {...fieldProps("greeting", "inv-greeting")}>{copy.greeting}</p>
      <p {...fieldProps("body", "inv-body")}>{copy.body}</p>
      <p {...fieldProps("details_line", "inv-details")}>{copy.details_line}</p>
      <p {...fieldProps("rsvp_prompt", "inv-rsvp")}>{copy.rsvp_prompt}</p>
      <p {...fieldProps("closing", "inv-closing")}>{copy.closing}</p>
    </div>
  );
}
