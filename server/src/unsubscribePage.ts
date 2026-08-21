// The unsubscribe page (adr-015 §7), and the only HTML this server renders
// that is not the SPA shell or an OG card.
//
// It is opened from a mail client, so it can assume nothing: no session, no
// `styles.css` bundle, no JavaScript, often a phone on a bad connection. The
// composition is deliberately the *same* one as the guest page's "invitation
// not found" state — same 96px circle, same Playfair heading, same widths —
// which is what makes a page outside the SPA still read as part of the product
// when it has access to none of the product's state (DS NotifyUnsub).
//
// **No external requests.** Both icons are inline SVG and there is no webfont
// link: this page's whole job is to work when opened cold from an inbox, and a
// render-blocking font request is the wrong thing to depend on. Playfair is
// used if the reader happens to have it and Georgia otherwise, which the
// mockup requires anyway — it is the one page in the product that has to be
// correct with no webfonts at all.
//
// Nothing here is escaped because nothing here is authored by anyone but us:
// no invitation title, no address, and the token is never echoed back.

import type { Language } from "./schemas.js";

/** What the reader is looking at.
 *
 *  `confirm` exists because **GET must not mutate**: mail scanners, link
 *  prefetchers and antivirus proxies follow links in mail automatically, so a
 *  GET that unsubscribed would silently opt hosts out via their own provider.
 *  The button posts; one-click (RFC 8058) posts directly and never sees this
 *  state. */
export type UnsubscribeState = "confirm" | "done" | "dead";

interface PageStrings {
  confirmTitle: string;
  confirmBody: string;
  confirmAction: string;
  doneTitle: string;
  doneBody: string;
  doneHint: string;
  deadTitle: string;
  deadBody: string;
  back: string;
  /** The language this page is *not* in, as its own switcher label. */
  other: string;
}

const STRINGS: Record<Language, PageStrings> = {
  uk: {
    confirmTitle: "Вимкнути листи про відповіді?",
    confirmBody: "Ми більше не надсилатимемо вам листів про відповіді на ваші запрошення.",
    confirmAction: "Вимкнути листи",
    doneTitle: "Листи вимкнено",
    doneBody: "Ми більше не надсилатимемо листів про відповіді на ваші запрошення.",
    doneHint:
      "Відповіді залишаються на сторінках ваших запрошень. Увімкнути листи знову можна в панелі після публікації.",
    deadTitle: "Це посилання вже не діє",
    deadBody: "Керувати листами можна в самому запрошенні — відкрийте його у своєму акаунті.",
    back: "Повернутися до INVINTO",
    other: "EN",
  },
  en: {
    confirmTitle: "Turn off reply emails?",
    confirmBody: "We'll stop emailing you about replies to your invitations.",
    confirmAction: "Turn off emails",
    doneTitle: "Emails are off",
    doneBody: "We won't email you about replies to your invitations any more.",
    doneHint:
      "The replies stay on your invitation pages. You can turn emails back on from the share panel after you publish.",
    deadTitle: "This link no longer works",
    deadBody: "You can manage emails from your invitation — open it while signed in.",
    back: "Back to INVINTO",
    other: "УКР",
  },
};

/** The struck envelope, as in the share panel's "off" line and the not-found
 *  page — one glyph across three surfaces. The knockout stroke is the circle's
 *  own background so the strike does not merge with the outline. */
const MAIL_OFF_ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
<rect x="3" y="6" width="18" height="12.5" rx="2.4" stroke="#b7ae9e" stroke-width="1.6"/>
<path d="M4 8.2l8 5.6 8-5.6" stroke="#b7ae9e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M3.2 19.8L20.8 4.7" stroke="#efece6" stroke-width="3.6" stroke-linecap="round"/>
<path d="M3.2 19.8L20.8 4.7" stroke="#a29a8b" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

/** The dashed envelope: in the DS this means "there is nothing here", which is
 *  exactly what a token we cannot resolve should say. */
const MAIL_GONE_ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
<rect x="3" y="6" width="18" height="13" rx="2.5" stroke="#b7ae9e" stroke-width="1.6" stroke-dasharray="3 2.4"/>
<path d="M4 8l8 6 8-6" stroke="#b7ae9e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#f6f5f2;color:#23211d;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;
     min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;
     text-align:center;padding:32px 34px}
.u-lang{position:absolute;top:16px;right:16px;font-size:0.82rem;font-weight:700;color:#8f887a;
        text-decoration:none;background:#efece6;border:1px solid #e4ddd0;border-radius:999px;
        min-width:46px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px}
.u-lang:hover{color:#23211d}
.u-icon{width:96px;height:96px;border-radius:50%;background:#efece6;display:flex;align-items:center;
        justify-content:center;margin-bottom:24px}
.u-icon svg{width:42px;height:42px}
h1{font-family:"Playfair Display",Georgia,serif;font-size:1.55rem;font-weight:700;margin:0 0 12px}
.u-body{font-size:0.98rem;color:#6b6659;line-height:1.55;max-width:290px;margin:0}
.u-hint{font-size:0.9rem;color:#a29a8b;line-height:1.5;max-width:290px;margin:16px 0 0}
.u-act{margin-top:24px}
.u-btn{border:none;border-radius:16px;background:#b3592e;color:#fff;font:inherit;font-size:1rem;
       font-weight:700;padding:0 26px;height:52px;cursor:pointer}
.u-btn:hover{background:#9f4d26}
.u-back{display:inline-block;margin-top:28px;font-size:0.92rem;font-weight:600;color:#6b6659;
        text-decoration:underline;text-underline-offset:3px;text-decoration-color:#cfc7b8}
.u-back:hover{color:#b3592e}
.u-mark{position:absolute;bottom:22px;left:0;right:0;font-size:0.72rem;font-weight:600;color:#c3bbac;
        letter-spacing:0.1em}
@media (min-width:641px){
  body{padding:40px}
  .u-icon{width:112px;height:112px;margin-bottom:28px}
  .u-icon svg{width:50px;height:50px}
  h1{font-size:2rem;margin-bottom:14px}
  .u-body{font-size:1.08rem;max-width:460px}
  .u-hint{font-size:0.95rem;max-width:460px;margin-top:18px}
  .u-mark{top:24px;bottom:auto;font-size:0.74rem;font-weight:700;letter-spacing:0.12em}
}`;

/** Which language to render in.
 *
 *  The token is account-wide and an account has no language of its own — the
 *  invitation used to supply one and no longer can. So the header decides and
 *  the switcher overrides, which also means the page works for a host reading
 *  mail on someone else's device. */
export function pageLanguage(acceptLanguage: string | undefined, override?: string): Language {
  if (override === "uk" || override === "en") return override;
  // Crude on purpose: the only question is whether Ukrainian outranks English,
  // and a full q-value parse would be more code than the answer is worth.
  const header = (acceptLanguage ?? "").toLowerCase();
  const uk = header.indexOf("uk");
  const en = header.indexOf("en");
  if (uk === -1) return "en";
  return en === -1 || uk < en ? "uk" : "en";
}

export function renderUnsubscribePage(state: UnsubscribeState, language: Language, token: string) {
  const t = STRINGS[language];
  const other: Language = language === "uk" ? "en" : "uk";
  const icon = state === "dead" ? MAIL_GONE_ICON : MAIL_OFF_ICON;

  const title = state === "confirm" ? t.confirmTitle : state === "done" ? t.doneTitle : t.deadTitle;
  const body = state === "confirm" ? t.confirmBody : state === "done" ? t.doneBody : t.deadBody;

  // Only the confirm state carries an action, and it is a form post — the page
  // has no JavaScript and needs none.
  const action =
    state === "confirm"
      ? `<form class="u-act" method="post" action="/unsubscribe/${token}">
<button class="u-btn" type="submit">${t.confirmAction}</button>
</form>`
      : "";
  // The reassurance belongs only to "done": it answers a question the reader
  // has just created, and on the other two states there is nothing to reassure.
  const hint = state === "done" ? `<p class="u-hint">${t.doneHint}</p>` : "";

  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · INVINTO</title>
<style>${STYLE}</style>
</head>
<body>
<a class="u-lang" href="/unsubscribe/${token}?lang=${other}">${t.other}</a>
<div class="u-icon">${icon}</div>
<h1>${title}</h1>
<p class="u-body">${body}</p>
${hint}
${action}
<a class="u-back" href="/">${t.back}</a>
<div class="u-mark">INVINTO</div>
</body>
</html>`;
}
