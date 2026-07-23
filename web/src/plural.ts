// Ukrainian needs three plural forms where English needs two, so guest counts
// can't be pluralized by an `n === 1` check. The forms come from the locale
// strings (GuestStrings.guestForms) as [one, few, many]:
//   uk: 1 гість / 2-4 гості / 5+ гостей
//   en: 1 guest / N guests  (few and many are the same string)
export type PluralForms = [one: string, few: string, many: string];

/** Pick the plural form for `n` using the Slavic one/few/many rule. English
 *  passes the same string for few and many, so the rule is a no-op there. */
export function pluralForm(n: number, forms: PluralForms): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  // 11-14 take "many" despite ending in 1-4 (11 гостей, not 11 гість).
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  const mod10 = abs % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
