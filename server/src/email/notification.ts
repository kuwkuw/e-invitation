// The reply-notification message itself: subject, HTML part, text part.
// Built from the DS `templates/rsvp-notifications/NotifyEmail` mockup.
//
// What it deliberately does not contain is the point of adr-015 §3 — no guest
// name, no yes/no, no party size, no note. A title, a count and a link. Every
// reply would otherwise ship a guest's name and their attendance at a named
// private event to a third-party mail provider, for guests who agreed to
// nothing beyond typing into a form on the host's page. adr-013 §2 declined a
// better view count over a smaller version of that trade.
//
// The composition does not try to fill the card around those three facts: the
// **count is the headline**, because it is the only thing that changes between
// messages and it is the news. The invitation title sits above it as a header
// answering "which event", not "what happened".
//
// The link is bare `/manage/:id` with no `#t=` fragment (§2). The keyring
// supplies the manage token once the host signs in (FR-11.3), so a forwarded
// notification or a breached mailbox grants nothing. The unsubscribe URL is
// the one credential in the message and it can do exactly one thing (§7).

import type { Language } from "../schemas.js";
import { emailStrings, fill, replyCount, truncateTitle } from "./strings.js";

export interface ReplyNotification {
  /** The invitation's own title — host-authored copy, so it is escaped
   *  everywhere it lands in markup. */
  title: string;
  /** Replies since this host was last notified (adr-015 §4). */
  newReplies: number;
  language: Language;
  /** Absolute `/manage/:id`, carrying no token. */
  manageUrl: string;
  /** Absolute unsubscribe URL, carrying the row-key token. */
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// og.ts has its own copy of this for meta tags. Deliberately not shared: that
// one escapes for an attribute in a `<meta>` tag we control, this one escapes
// host-authored copy into an email body, and a single helper serving both
// would be a shared dependency between the OG renderer and the mail templates
// for the sake of five lines. Apostrophes are escaped here and not there —
// Ukrainian copy uses them (`З любов'ю`) and they land inside attributes.
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Wrap for the text/plain part. 68 rather than 78 leaves room for the `> `
 *  a reply adds without reflowing, and URLs are never wrapped or shortened —
 *  a shortener in a plain-text part is a strong spam signal. */
function wrap(text: string, width = 68): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line === "") line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines.join("\n");
}

/**
 * Renders both parts of one notification.
 *
 * Table layout, inline styles on every text-bearing `td`, and no web fonts:
 * an email client is not a browser. Inheritance does not work, `max-width` is
 * ignored by Outlook, and a CSS `border-top` is unreliable — so the width is
 * an attribute, every cell restates its own type, and the rule is its own
 * `bgcolor` cell. Georgia stands in for the DS's Playfair at display sizes and
 * Arial carries everything small.
 *
 * Dark mode is requested, not assumed. The two `color-scheme` metas are what
 * make Apple Mail take the palette below instead of inverting bluntly; clients
 * that invert regardless (Gmail on Android, Outlook on Windows) still land
 * somewhere readable because no text is `#000` and no type sits on pure white.
 *
 * The text part is not optional: a transactional email without one is a spam
 * signal, and it is the version that renders correctly everywhere.
 */
export function renderReplyNotification(notification: ReplyNotification): RenderedEmail {
  const strings = emailStrings(notification.language);
  const count = replyCount(notification.newReplies, strings);
  const header = truncateTitle(notification.title);

  const subject = fill(strings.subject, { count, title: notification.title });
  const why = fill(strings.why, { title: notification.title });

  const safe = {
    header: escapeHtml(header),
    count: escapeHtml(count),
    lead: escapeHtml(strings.lead),
    cta: escapeHtml(strings.cta),
    why: escapeHtml(why),
    unsubscribe: escapeHtml(strings.unsubscribe),
    wordmark: escapeHtml(strings.wordmark),
    manageUrl: escapeHtml(notification.manageUrl),
    unsubscribeUrl: escapeHtml(notification.unsubscribeUrl),
  };

  const html = `<!doctype html>
<html lang="${notification.language}">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
@media (prefers-color-scheme: dark) {
  .n-page { background: #1b1917 !important; }
  .n-card { background: #262320 !important; border-color: #3a352f !important; }
  .n-mark, .n-muted { color: #a8a094 !important; }
  .n-title { color: #f0ece4 !important; }
  .n-lead { color: #c4bcb0 !important; }
  .n-rule { background: #3a352f !important; }
  .n-btn { background: #c76a3c !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#faf7f2;">
<table class="n-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf7f2" style="background:#faf7f2;">
<tr><td align="center" style="padding:32px 16px;">
<table class="n-card" width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:520px;background:#ffffff;border:1px solid #ece6dc;border-radius:12px;border-collapse:separate;">
<tr><td class="n-mark" style="padding:28px 30px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.14em;color:#b5ac9d;">${safe.wordmark}</td></tr>
<tr><td class="n-muted" style="padding:24px 30px 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#8d8577;line-height:1.4;">${safe.header}</td></tr>
<tr><td class="n-title" style="padding:5px 30px 0;font-family:Georgia,'Times New Roman',serif;font-size:27px;color:#2f2a24;line-height:1.25;">${safe.count}</td></tr>
<tr><td class="n-lead" style="padding:13px 30px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#6b6659;line-height:1.55;">${safe.lead}</td></tr>
<tr><td style="padding:22px 30px 0;"><table cellpadding="0" cellspacing="0" border="0"><tr><td class="n-btn" bgcolor="#b3592e" style="background:#b3592e;border-radius:8px;"><a href="${safe.manageUrl}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${safe.cta}</a></td></tr></table></td></tr>
<tr><td style="padding:26px 30px 0;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="n-rule" bgcolor="#ece6dc" height="1" style="background:#ece6dc;height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>
<tr><td class="n-muted" style="padding:15px 30px 30px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8d8577;line-height:1.6;">${safe.why}<br><a href="${safe.unsubscribeUrl}" style="color:#8d8577;text-decoration:underline;">${safe.unsubscribe}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  // The same three facts in the same order. `--` is the separator mail clients
  // understand as the start of a signature block.
  const text = [
    header,
    count,
    "",
    wrap(strings.lead),
    notification.manageUrl,
    "",
    "--",
    wrap(why),
    `${strings.unsubscribe}:`,
    notification.unsubscribeUrl,
  ].join("\n");

  return { subject, html, text };
}
