// Deterministic checks for the eval. Pure functions only — no model calls —
// so they are unit-tested in the ordinary suite (test/evalChecks.test.ts) and
// a broken check fails CI without any provider key.
//
// The copy checks are heuristics on purpose: they catch the failures the
// product cannot afford (wrong language, placeholders, an invented date or
// year, a stated fact dropped) and leave wording quality to the regenerate
// rate in production.

import type { EventBrief, Invitation } from "../src/schemas.js";
import type { BriefExpectation } from "./cases.js";

export interface CheckResult {
  check: string;
  pass: boolean;
  detail?: string;
}

/** Case-, apostrophe- and quote-insensitive form for substring matching:
 *  a model may write «Затишок», "Затишок" or Мар’ян for Мар'ян. */
export function norm(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’ʼ`´]/g, "'")
    .replace(/[«»“”„]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const contains = (haystack: string, needle: string) => norm(haystack).includes(norm(needle));

function checkField(
  name: "date" | "time" | "venue" | "city",
  actual: string | null,
  expected: string | null | undefined,
): CheckResult | null {
  if (expected === undefined) return null;
  const check = `brief.${name}`;
  if (expected === null) {
    return actual === null
      ? { check, pass: true }
      : { check, pass: false, detail: `expected null, got ${JSON.stringify(actual)}` };
  }
  if (actual === null) return { check, pass: false, detail: `expected "${expected}", got null` };
  return contains(actual, expected)
    ? { check, pass: true }
    : { check, pass: false, detail: `expected to contain "${expected}", got "${actual}"` };
}

/** A result whose detail is only kept when it failed. */
const result = (check: string, pass: boolean, detail: string): CheckResult =>
  pass ? { check, pass } : { check, pass, detail };

function checkHosts(hosts: string[], expected: string[] | "none"): CheckResult {
  if (expected === "none") {
    return result("brief.hosts", hosts.length === 0, `expected none, got ${JSON.stringify(hosts)}`);
  }
  const missing = expected.filter((stem) => !hosts.some((h) => contains(h, stem)));
  return result(
    "brief.hosts",
    missing.length === 0,
    `missing ${JSON.stringify(missing)} in ${JSON.stringify(hosts)}`,
  );
}

function checkExtra(extra: string | null, expected: "present" | null): CheckResult {
  const present = extra !== null && extra.trim() !== "";
  return result(
    "brief.extra_details",
    expected === "present" ? present : !present,
    `expected ${expected ?? "null"}, got ${JSON.stringify(extra)}`,
  );
}

export function checkBrief(brief: EventBrief, expect: BriefExpectation): CheckResult[] {
  const results: CheckResult[] = [];
  if (expect.language) {
    results.push(
      result("brief.language", brief.language === expect.language, `got "${brief.language}"`),
    );
  }
  if (expect.eventType) {
    results.push(
      result(
        "brief.event_type",
        expect.eventType.test(brief.event_type),
        `"${brief.event_type}" !~ ${expect.eventType}`,
      ),
    );
  }
  if (expect.hosts) results.push(checkHosts(brief.hosts, expect.hosts));
  for (const name of ["date", "time", "venue", "city"] as const) {
    const field = checkField(name, brief[name], expect[name]);
    if (field) results.push(field);
  }
  if (expect.extra !== undefined) results.push(checkExtra(brief.extra_details, expect.extra));
  return results;
}

/** Numbers as values, so "09" and "9" are the same fact. */
export function numbersIn(text: string): Set<string> {
  return new Set((text.match(/\d+/g) ?? []).map((n) => String(Number(n))));
}

// Month names → their number, so "12 серпня" restated as "12.08" (or
// "August 12" as "12/08") is a reformatting, not an invented fact. Ukrainian
// stems cover every case form; English matches the full name or its
// abbreviation.
const MONTHS: [RegExp, number][] = [
  [/січ|jan/i, 1],
  [/лют|feb/i, 2],
  [/берез|mar(?:ch)?\b/i, 3],
  [/квіт|apr/i, 4],
  [/трав|\bmay\b/i, 5],
  [/черв|jun/i, 6],
  [/лип|jul/i, 7],
  [/серп|aug/i, 8],
  [/верес|sep/i, 9],
  [/жовт|oct/i, 10],
  [/листоп|nov/i, 11],
  [/груд|dec/i, 12],
];

/** Every number the copy states must come from the sentence. A 12-hour time
 *  may be restated as 24-hour ("7pm" → "19:00"), a named month as its number
 *  ("серпня" → "08"), and "00" minutes are formatting, not a fact. Anything
 *  else — a year, a date, an end time — the model invented. */
export function inventedNumbers(copyText: string, input: string): string[] {
  const allowed = numbersIn(input);
  for (const n of [...allowed]) {
    const v = Number(n);
    if (v >= 1 && v <= 12) allowed.add(String(v + 12));
    if (v >= 13 && v <= 24) allowed.add(String(v - 12));
  }
  for (const [name, month] of MONTHS) if (name.test(input)) allowed.add(String(month));
  allowed.add("0");
  return [...numbersIn(copyText)].filter((n) => !allowed.has(n));
}

/** Where a number appears, so a failure shows the sentence it sits in rather
 *  than a bare digit. */
export function whereNumber(fields: [string, string][], n: string): string {
  const re = new RegExp(`(?<!\\d)0*${n}(?!\\d)`);
  const hit = fields.find(([, v]) => re.test(v));
  return hit ? `${n} in ${hit[0]}: "${hit[1]}"` : n;
}

const PLACEHOLDER =
  /\[[^\]]{1,40}\]|\{\{?[^}]{1,40}\}\}?|\bTBD\b|\bTBA\b|\bXX+\b|lorem ipsum|<[a-z_]+>/i;

/** Share of letters in the given script, after removing the strings the
 *  user supplied — a Cyrillic venue in English copy is the host's fact, not
 *  a language slip. */
function scriptShare(text: string, script: "Cyrillic" | "Latin", exclude: string[]): number {
  let rest = text;
  for (const s of exclude) if (s) rest = rest.split(s).join(" ");
  const letters = rest.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 1;
  const re = script === "Cyrillic" ? /\p{Script=Cyrillic}/u : /\p{Script=Latin}/u;
  return letters.filter((l) => re.test(l)).length / letters.length;
}

const stem = (word: string) => norm(word).slice(0, 5);

export function checkCopy(input: string, invitation: Invitation): CheckResult[] {
  const { brief, copy } = invitation;
  const fields = Object.entries(copy) as [string, string][];
  const all = fields.map(([, v]) => v).join("\n");
  const results: CheckResult[] = [];

  const empty = fields.filter(([, v]) => v.trim() === "").map(([k]) => k);
  results.push({
    check: "copy.non_empty",
    pass: empty.length === 0,
    detail: empty.length ? `empty: ${empty.join(", ")}` : undefined,
  });

  const placeholder = fields.find(([, v]) => PLACEHOLDER.test(v));
  results.push({
    check: "copy.no_placeholders",
    pass: !placeholder,
    detail: placeholder ? `${placeholder[0]}: "${placeholder[1]}"` : undefined,
  });

  const supplied = [
    ...brief.hosts,
    brief.venue,
    brief.city,
    brief.date,
    brief.time,
    brief.extra_details,
  ].filter((s): s is string => Boolean(s));
  if (brief.language === "uk") {
    const latin = scriptShare(all, "Latin", supplied);
    results.push({
      check: "copy.language",
      pass: latin <= 0.2,
      detail: latin <= 0.2 ? undefined : `${Math.round(latin * 100)}% Latin letters in uk copy`,
    });
  } else {
    const cyr = scriptShare(all, "Cyrillic", supplied);
    results.push({
      check: "copy.language",
      pass: cyr <= 0.05,
      detail: cyr <= 0.05 ? undefined : `${Math.round(cyr * 100)}% Cyrillic letters in en copy`,
    });
  }

  const invented = inventedNumbers(all, input);
  results.push({
    check: "copy.no_invented_numbers",
    pass: invented.length === 0,
    detail: invented.length
      ? `not in the sentence: ${invented.map((n) => whereNumber(fields, n)).join("; ")}`
      : undefined,
  });

  // A stated date/time/venue must reach the card. Numbers are compared as
  // values; a date with none ("наступної суботи") needs one of its words.
  const stated = (value: string | null, where: string) => {
    if (!value) return true;
    const nums = numbersIn(value);
    const here = numbersIn(where);
    if (nums.size > 0) return [...nums].every((n) => here.has(n));
    const words = value.split(/[\s,.]+/).filter((w) => w.length >= 4);
    return words.length === 0 || words.some((w) => norm(where).includes(stem(w)));
  };
  const lost = (["date", "time", "venue"] as const).filter(
    (k) => !stated(brief[k], `${copy.details_line}\n${copy.body}`),
  );
  results.push({
    check: "copy.keeps_stated_facts",
    pass: lost.length === 0,
    detail: lost.length ? `missing from details/body: ${lost.join(", ")}` : undefined,
  });

  if (brief.hosts.length > 0) {
    const named = brief.hosts.some((h) => norm(all).includes(norm(h).slice(0, 4)));
    results.push({
      check: "copy.names_hosts",
      pass: named,
      detail: named ? undefined : `none of ${JSON.stringify(brief.hosts)} appears`,
    });
  }

  results.push({
    check: "copy.title_length",
    pass: copy.title.length <= 90,
    detail: copy.title.length <= 90 ? undefined : `${copy.title.length} chars`,
  });

  return results;
}
