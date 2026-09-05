import { describe, expect, it } from "vitest";
import { AUTH, CRASH, GUEST, LANDING, MANAGE, SEO, UI } from "../src/i18n";

/**
 * The bilingual UI (FR-6) is enforced by types only as far as *keys*: a
 * `Record<Language, X>` makes a missing English key a compile error, and says
 * nothing about a key whose English value is still Ukrainian, or an English
 * array that lost an entry its Ukrainian twin kept.
 *
 * Both of those had shipped. The landing page's sample invitations and its
 * mocked reply rows sat in the component as Ukrainian literals, so `?lang=en`
 * — the English home page's own indexed address (adr-016 §5) — answered an
 * English visitor's one real question, *what does an invitation look like*, in
 * a language they cannot read.
 *
 * So these two checks run over every table in `i18n.ts` at once, rather than
 * over the tables that happened to be wrong. Adding a table adds it here.
 */

/** Every leaf string in a table, with the path that reached it — so a failure
 *  names `LANDING.samples.wedding.title`, not "some string". */
function leaves(value: unknown, path: string): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  }
  return [];
}

/** The shape alone: keys and array lengths, with the strings thrown away. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([k, v]) => [k, shape(v)] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return typeof value;
}

const CYRILLIC = /[Ѐ-ӿ]/;

const tables = { AUTH, CRASH, GUEST, LANDING, MANAGE, SEO, UI } as const;

describe("i18n tables", () => {
  // `INVINTO` is the one string deliberately identical in both (adr-016 §9),
  // and it is Latin, so it needs no exception here. The reverse check — no
  // Latin in the Ukrainian tables — is not possible and not wanted: Viber,
  // Telegram, Google, RSVP, CSV and the brand itself all belong there.
  it.each(Object.entries(tables))("has no Ukrainian left in %s.en", (name, table) => {
    const untranslated = leaves(table.en, `${name}.en`)
      .filter(([, text]) => CYRILLIC.test(text))
      .map(([path]) => path);
    expect(untranslated).toEqual([]);
  });

  // Catches what the types cannot: an example, a step or an occasion chip
  // added to one language and not the other. Sorted keys, because insertion
  // order is not part of the contract — only the set is.
  it.each(Object.entries(tables))("gives %s the same shape in both languages", (_name, table) => {
    expect(shape(table.en)).toEqual(shape(table.uk));
  });
});

describe("the landing page's demo content", () => {
  // The hero and the RSVP mock are the page's only *content*, as opposed to
  // its claims about content — which makes them the part an English visitor
  // is there to judge. They live in `LANDING` so that stays true.
  it.each(["uk", "en"] as const)("gives %s three complete sample invitations", (lang) => {
    const samples = Object.values(LANDING[lang].samples);
    expect(samples).toHaveLength(3);
    for (const sample of samples) {
      for (const line of Object.values(sample)) expect(line.trim()).not.toBe("");
    }
  });

  it("says something different in each language", () => {
    expect(LANDING.en.samples.wedding.title).not.toBe(LANDING.uk.samples.wedding.title);
    expect(LANDING.en.rsvpNames.friend).not.toBe(LANDING.uk.rsvpNames.friend);
  });
});
