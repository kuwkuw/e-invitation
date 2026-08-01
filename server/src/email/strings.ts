// Email copy, both languages (adr-015 §9), from the DS
// `templates/rsvp-notifications` mockups.
//
// The first user-facing strings on the server that are not a prompt. NFR-5's
// rule is that copy lives in one place per side — `web/src/i18n.ts` on the
// client, the prompts on the server — so this module is that place for mail,
// and no handler or renderer builds a sentence of its own.
//
// The language is the invitation's own (`brief.language`), not the UI toggle,
// which is browser-local and never reaches the server, and not the guest's
// chrome language, which is a guest's choice about someone else's page
// (FR-6.3). The host wrote their sentence in one of these two; that is the one
// they get mail in.

import type { Language } from "../schemas.js";

/** [one, few, many] — the Slavic three-form rule. English passes the same
 *  string for few and many, exactly as `web/src/plural.ts` does, so the
 *  selector is a no-op there rather than a special case. */
export type PluralForms = [one: string, few: string, many: string];

export interface EmailStrings {
  /** "N new replies", assembled with `pluralForm`. */
  replyForms: PluralForms;
  /** Count first, then the title: an inbox list truncates from the end, and
   *  the count is the only thing that changes between messages. */
  subject: string;
  /** Where to look. Count-independent on purpose — the count is already the
   *  headline, and a lead that agreed with it in number would need its own
   *  plural forms to avoid reading wrong at 1. */
  lead: string;
  cta: string;
  /** Why this arrived. `{title}` is the invitation, quoted in the language's
   *  own quotation marks. Answering it in the mail is what keeps the
   *  unsubscribe from being the only explanation a host gets. */
  why: string;
  /** Deliberately says "these emails", not "this invitation": the link turns
   *  reply mail off for the whole account, which is what a mail client's
   *  one-click unsubscribe promises (adr-015 §7). */
  unsubscribe: string;
  wordmark: string;
}

const STRINGS: Record<Language, EmailStrings> = {
  uk: {
    replyForms: ["нова відповідь", "нові відповіді", "нових відповідей"],
    subject: "{count} — {title}",
    lead: "Гості почали відповідати. Повний список — на сторінці запрошення.",
    cta: "Переглянути відповіді",
    why: "Ви отримали цей лист, бо створили запрошення «{title}» в INVITO.",
    unsubscribe: "Не надсилати мені такі листи",
    wordmark: "INVITO",
  },
  en: {
    replyForms: ["new reply", "new replies", "new replies"],
    subject: "{count} — {title}",
    lead: "Guests have started replying. The full list is on your invitation page.",
    cta: "See the replies",
    why: "You're getting this because you created the invitation “{title}” on INVITO.",
    unsubscribe: "Turn these emails off",
    wordmark: "INVITO",
  },
};

export function emailStrings(language: Language): EmailStrings {
  return STRINGS[language];
}

/** The one/few/many selector, mirroring `web/src/plural.ts`. Duplicated rather
 *  than shared because the two workspaces have no common module and this is
 *  nine lines of arithmetic; if a third copy ever appears, extract it then. */
export function pluralForm(n: number, forms: PluralForms): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  // 11-14 take "many" despite ending in 1-4 (11 відповідей, not 11 відповідь).
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  const mod10 = abs % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** "3 нові відповіді" / "3 new replies". */
export function replyCount(n: number, strings: EmailStrings): string {
  return `${n} ${pluralForm(n, strings.replyForms)}`;
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** The title above the count is composition, not prose — past two lines it
 *  stops being a header. The footer keeps the untruncated title, where it sits
 *  inside a sentence instead (DS NotifyEmail). */
export function truncateTitle(title: string, max = 90): string {
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}
