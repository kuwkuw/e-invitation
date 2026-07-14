import type { DesignTokens, InvitationCopy } from "../types";

interface Props {
  copy: InvitationCopy;
  design: DesignTokens;
}

// Deterministic renderer: design tokens map 1:1 to CSS classes defined in
// styles.css. No model output is ever interpreted as markup or styles.
export function InvitationPreview({ copy, design }: Props) {
  const classes = [
    "inv",
    `palette-${design.palette}`,
    `type-${design.typography}`,
    `layout-${design.layout}`,
    `ornament-${design.ornament}`,
  ].join(" ");

  return (
    <div className={classes}>
      <div className="inv-ornament" aria-hidden="true" />
      <h2 className="inv-title">{copy.title}</h2>
      <p className="inv-greeting">{copy.greeting}</p>
      <p className="inv-body">{copy.body}</p>
      <p className="inv-details">{copy.details_line}</p>
      <p className="inv-rsvp">{copy.rsvp_prompt}</p>
      <p className="inv-closing">{copy.closing}</p>
    </div>
  );
}
