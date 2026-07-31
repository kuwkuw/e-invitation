// The reply-notification message itself: subject, HTML part, text part.
//
// What it deliberately does not contain is the point of adr-015 §3 — no guest
// name, no yes/no, no party size, no note. A count and a link. Every reply
// would otherwise ship a guest's name and their attendance at a named private
// event to a third-party mail provider, for guests who agreed to nothing
// beyond typing into a form on the host's page. adr-013 §2 declined a better
// view count over a smaller version of that trade.
//
// The link is bare `/manage/:id` with no `#t=` fragment (§2). The keyring
// supplies the manage token once the host signs in (FR-11.3), so a forwarded
// notification or a breached mailbox grants nothing. The unsubscribe URL is
// the one credential in the message and it can do exactly one thing (§7).

import type { Language } from "../schemas.js";
import { emailStrings, fill, replyCount } from "./strings.js";

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

/** Renders both parts of one notification.
 *
 *  The HTML is table layout with inline styles and no web fonts, because an
 *  email client is not a browser: no custom properties, no flexbox worth
 *  relying on, no `<style>` block that survives every client, and a dark mode
 *  the client decides unilaterally. adr-015 §10 wanted a mockup for "what the
 *  card degrades to" — but §3 left no card to degrade. A count-only email is a
 *  sentence, a link and a footer, which is why this renders without one.
 *
 *  The text part is not optional: a transactional email without one is a spam
 *  signal, and it is the version that renders correctly everywhere. */
export function renderReplyNotification(notification: ReplyNotification): RenderedEmail {
  const strings = emailStrings(notification.language);
  const count = replyCount(notification.newReplies, strings);
  const values = { count, title: notification.title };

  const subject = fill(strings.subject, values);
  const lead = fill(strings.lead, values);

  const safe = {
    lead: escapeHtml(lead),
    cta: escapeHtml(strings.cta),
    why: escapeHtml(strings.why),
    unsubscribe: escapeHtml(strings.unsubscribe),
    signature: escapeHtml(strings.signature),
    manageUrl: escapeHtml(notification.manageUrl),
    unsubscribeUrl: escapeHtml(notification.unsubscribeUrl),
  };

  // Colours are literals rather than the palette tokens: `styles.css` is not
  // reachable from an inbox, and the invitation's own palette belongs to the
  // card, not to a message about it.
  const html = `<!doctype html>
<html lang="${notification.language}">
<body style="margin:0;padding:0;background:#faf7f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf7f2;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:32px 28px 24px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;color:#2f2a24;">
${safe.lead}
</td></tr>
<tr><td style="padding:0 28px 28px;">
<a href="${safe.manageUrl}" style="display:inline-block;padding:12px 22px;background:#2f2a24;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${safe.cta}</a>
</td></tr>
<tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8d8577;border-top:1px solid #ece6dc;padding-top:20px;">
${safe.why}<br>
<a href="${safe.unsubscribeUrl}" style="color:#8d8577;">${safe.unsubscribe}</a>
</td></tr>
</table>
<div style="padding:16px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#b5ac9d;">${safe.signature}</div>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    lead,
    "",
    `${strings.cta}: ${notification.manageUrl}`,
    "",
    strings.why,
    `${strings.unsubscribe}: ${notification.unsubscribeUrl}`,
    "",
    strings.signature,
  ].join("\n");

  return { subject, html, text };
}
