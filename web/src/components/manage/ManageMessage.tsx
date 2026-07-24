import type { ReactNode } from "react";

/** Terminal states with nothing to paste: the invitation doesn't exist, or the
 *  request failed. Same calm shell as the prompts, with an optional retry. */
export function ManageMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="hm-card hm-prompt">
      <span className="hm-state-icon">{icon}</span>
      <h1 className="hm-state-title">{title}</h1>
      <p className="hm-state-body">{body}</p>
      {action && (
        <button type="button" className="hm-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
}
