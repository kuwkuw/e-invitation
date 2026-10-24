import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ChatStrings } from "../../i18n";
import type { PublishResult, RsvpCounts } from "../../types";
import { BackIcon } from "./icons";

/** «16 буде · 3 ні · 2 можливо»: the headcount (FR-5.2's `guests`), then the
 *  declines, then the maybes, in adr-019 §8.2's order, each only when someone
 *  gave it. A maybe is reported beside the headcount and never added to it
 *  (§9.1). Before the counts arrive, or if they never do, the line is the
 *  link's own name: it leads to the dashboard either way. */
export function repliesLine(counts: RsvpCounts | null, t: ChatStrings): string {
  if (!counts) return t.repliesLink;
  if (counts.yes + counts.no + counts.maybe === 0) return t.repliesNone;
  const part = (template: string, n: number) => (n > 0 ? template.replace("{n}", String(n)) : null);
  return [
    part(t.repliesComing, counts.guests),
    part(t.repliesNo, counts.no),
    part(t.repliesMaybe, counts.maybe),
  ]
    .filter((text): text is string => text !== null)
    .join(" · ");
}

/**
 * The editor's header (adr-019 §7.2): a bar on card stock, not the floating
 * pill it was under glass, with the back button, the hosts' seal, the title
 * and the controls it is handed.
 *
 * After the first publish the title gains a link to `/manage/:id` carrying the
 * replies so far. It leaves in the same tab, as the share panel's own link
 * does: a new tab inside a messenger's webview opens without the manage token
 * this browser holds. On a phone the stylesheet moves it to a row of its own
 * across the bar's foot, because the title column there is narrower than
 * «16 буде · 3 ні».
 */
export function EditorHeader({
  title,
  monogram,
  published,
  counts,
  onBack,
  children,
  t,
}: {
  title: string;
  monogram: string;
  /** The publish result; the replies link exists only once there is one. */
  published: PublishResult | null;
  counts: RsvpCounts | null;
  onBack: () => void;
  /** The AI key, the language switch and Publish, whose props stay in App. */
  children: ReactNode;
  t: ChatStrings;
}) {
  const line = repliesLine(counts, t);
  return (
    <header className="cc-header">
      <button type="button" className="cc-back" aria-label={t.back} onClick={onBack}>
        <BackIcon />
      </button>
      {/* Decoration: the title beside it names the same event in words. */}
      <span className="seal cc-seal" aria-hidden="true">
        {monogram}
      </span>
      <div className="cc-title">{title}</div>
      {published && (
        <Link
          className="cc-replies"
          to={`/manage/${published.id}`}
          aria-label={line === t.repliesLink ? line : `${t.repliesLink}: ${line}`}
        >
          {line}
        </Link>
      )}
      <div className="cc-header-right">{children}</div>
    </header>
  );
}
