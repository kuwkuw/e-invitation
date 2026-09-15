import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

/** The sheet one toolbar segment opens. Deliberately dims nothing: the card
 *  stays visible behind it so the host watches the token land. */
export function DesignSheet({ title, children }: Props) {
  return (
    <div className="cc-design-sheet glass-solid" role="group" aria-label={title}>
      <div className="cc-sheet-grab" />
      <div className="cc-design-sheet-title">{title}</div>
      <div className="cc-design-sheet-body">{children}</div>
    </div>
  );
}
