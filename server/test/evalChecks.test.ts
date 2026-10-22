// The eval's checks run against live models only in the scheduled workflow,
// so a broken check would otherwise go unnoticed until it misreports. These
// pin what each check accepts and rejects, with no provider key.

import { describe, expect, it } from "vitest";
import { CASES } from "../eval/cases.js";
import { checkBrief, checkCopy, inventedNumbers, norm } from "../eval/checks.js";
import { type LlmCall, primaryRateLimited, retryHintMs } from "../eval/harness.js";
import type { EventBrief, Invitation } from "../src/schemas.js";

const brief = (over: Partial<EventBrief> = {}): EventBrief => ({
  event_type: "birthday",
  hosts: ["Олена"],
  date: "12 серпня",
  time: "18:00",
  venue: "Кафе «Затишок»",
  city: "Львів",
  tone: "warm",
  language: "uk",
  extra_details: null,
  ...over,
});

const invitation = (b: EventBrief, copy: Partial<Invitation["copy"]> = {}): Invitation => ({
  brief: b,
  design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
  copy: {
    title: "Запрошення на день народження",
    greeting: "Дорогі друзі!",
    body: "Олена запрошує вас відсвяткувати разом у кафе «Затишок».",
    details_line: "12 серпня, 18:00 — Кафе «Затишок», Львів",
    rsvp_prompt: "Будь ласка, підтвердіть присутність.",
    closing: "З любов'ю, Олена",
    ...copy,
  },
});

const INPUT = "Олена запрошує друзів на день народження 12 серпня о 18:00, кафе «Затишок», Львів";
const failed = (results: { check: string; pass: boolean }[]) =>
  results.filter((r) => !r.pass).map((r) => r.check);

describe("eval cases", () => {
  it("have unique ids and cover both languages, mixed input and missing facts", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CASES.some((c) => c.expect.language === "uk")).toBe(true);
    expect(CASES.some((c) => c.expect.language === "en")).toBe(true);
    expect(CASES.some((c) => c.id.startsWith("mixed-"))).toBe(true);
    expect(CASES.some((c) => c.expect.date === null)).toBe(true);
  });

  it("rank the full-generation cases uniquely, so --generate N is deterministic", () => {
    const ranks = CASES.flatMap((c) => (c.generateRank === undefined ? [] : [c.generateRank]));
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ranks.length).toBeGreaterThanOrEqual(6);
  });

  it("expect only what the sentence actually says", () => {
    // A substring expectation absent from the input would be asking the model
    // to invent it. Stems may be shorter than the word, so compare normalized.
    for (const c of CASES) {
      for (const key of ["date", "time", "venue", "city"] as const) {
        const value = c.expect[key];
        if (typeof value === "string")
          expect(norm(c.input), `${c.id}.${key}`).toContain(norm(value));
      }
      if (Array.isArray(c.expect.hosts)) {
        for (const stem of c.expect.hosts)
          expect(norm(c.input), `${c.id}.hosts`).toContain(norm(stem));
      }
    }
  });
});

describe("checkBrief", () => {
  const expectFull = {
    language: "uk" as const,
    hosts: ["Олен"],
    date: "12 серпня",
    time: "18:00",
    venue: "Затишок",
    city: "Львів",
  };

  it("passes a faithful brief, matching through quotes and case", () => {
    expect(failed(checkBrief(brief(), expectFull))).toEqual([]);
  });

  it("fails an invented field the sentence never stated", () => {
    expect(failed(checkBrief(brief({ time: "19:00" }), { time: null }))).toEqual(["brief.time"]);
  });

  it("fails a dropped field and a wrong language", () => {
    expect(failed(checkBrief(brief({ venue: null, language: "en" }), expectFull))).toEqual([
      "brief.language",
      "brief.venue",
    ]);
  });

  it("treats apostrophe variants as the same name", () => {
    expect(failed(checkBrief(brief({ hosts: ["Мар’ян"] }), { hosts: ["Мар'ян"] }))).toEqual([]);
  });

  it("checks hosts: 'none' means an empty list", () => {
    expect(failed(checkBrief(brief({ hosts: [] }), { hosts: "none" }))).toEqual([]);
    expect(failed(checkBrief(brief(), { hosts: "none" }))).toEqual(["brief.hosts"]);
  });

  it("checks extra_details presence both ways", () => {
    expect(failed(checkBrief(brief(), { extra: "present" }))).toEqual(["brief.extra_details"]);
    expect(failed(checkBrief(brief({ extra_details: "dress code" }), { extra: null }))).toEqual([
      "brief.extra_details",
    ]);
  });
});

describe("inventedNumbers", () => {
  it("allows the sentence's numbers, 12/24-hour restatements and :00", () => {
    expect(inventedNumbers("August 12, 19:00", "on August 12 at 7pm")).toEqual([]);
    expect(inventedNumbers("о 07:00", "о 7")).toEqual([]);
  });

  it("flags a year or date the sentence never gave", () => {
    expect(inventedNumbers("12 серпня 2026 року", "12 серпня")).toEqual(["2026"]);
    expect(inventedNumbers("Чекаємо 15 числа", "без дати")).toEqual(["15"]);
  });
});

describe("checkCopy", () => {
  it("passes faithful Ukrainian copy", () => {
    expect(failed(checkCopy(INPUT, invitation(brief())))).toEqual([]);
  });

  it("catches a placeholder", () => {
    const inv = invitation(brief(), { details_line: "[DATE], 18:00" });
    expect(failed(checkCopy(INPUT, inv))).toContain("copy.no_placeholders");
  });

  it("catches English slipping into Ukrainian copy", () => {
    const inv = invitation(brief(), {
      body: "Join us for a wonderful evening of celebration with friends and family.",
      rsvp_prompt: "Please let us know if you can come.",
    });
    expect(failed(checkCopy(INPUT, inv))).toContain("copy.language");
  });

  it("does not count a Cyrillic venue the host supplied against English copy", () => {
    const b = brief({
      language: "en",
      hosts: ["Max"],
      venue: "Пивоварня",
      city: "Львів",
      date: "3 March",
      time: "9pm",
    });
    const inv = invitation(b, {
      title: "Birthday drinks for Max",
      greeting: "Hi friends!",
      body: "Max invites you for birthday drinks at Пивоварня.",
      details_line: "3 March, 9pm — Пивоварня, Львів",
      rsvp_prompt: "Let us know if you can make it.",
      closing: "Cheers, Max",
    });
    const input = "Birthday drinks for Max on 3 March at 9pm, Пивоварня, Львів";
    expect(failed(checkCopy(input, inv))).toEqual([]);
  });

  it("catches an invented year and a dropped time", () => {
    const inv = invitation(brief(), { details_line: "12 серпня 2026 — Кафе «Затишок», Львів" });
    expect(failed(checkCopy(INPUT, inv))).toEqual([
      "copy.no_invented_numbers",
      "copy.keeps_stated_facts",
    ]);
  });

  it("requires a stated host to be named somewhere, in any declension", () => {
    const named = invitation(brief(), {
      closing: "З любов'ю, Олени родина",
      body: "Чекаємо на вас!",
    });
    expect(failed(checkCopy(INPUT, named))).not.toContain("copy.names_hosts");
    const unnamed = invitation(brief(), {
      closing: "З любов'ю",
      body: "Чекаємо на вас у кафе «Затишок»!",
    });
    expect(failed(checkCopy(INPUT, unnamed))).toContain("copy.names_hosts");
  });

  it("does not demand facts the brief does not have", () => {
    const b = brief({ date: null, time: null, venue: null, city: null, hosts: [] });
    const inv = invitation(b, {
      body: "Запрошуємо на новосілля — буде піца і настолки.",
      details_line: "Деталі згодом",
      closing: "До зустрічі!",
    });
    expect(failed(checkCopy("Запрошую всіх на новосілля, буде піца і настолки", inv))).toEqual([]);
  });
});

describe("rate-limit handling", () => {
  it("reads the wait a provider asks for, in the forms Groq and Gemini use", () => {
    expect(
      retryHintMs(
        "groq 429: Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 7652, Requested 812. Please try again in 3.48s.",
      ),
    ).toBe(3480);
    expect(retryHintMs("Please try again in 1m3.5s")).toBe(63500);
    expect(retryHintMs("Please try again in 450ms")).toBe(450);
    expect(retryHintMs("gemini 429: Quota exceeded. Please retry in 41.2s.")).toBe(41200);
    expect(retryHintMs("gemini 429: RESOURCE_EXHAUSTED")).toBeNull();
  });

  const call = (over: Partial<LlmCall>): LlmCall => ({
    task: "brief_extraction",
    model: "openai/gpt-oss-120b",
    fallback: false,
    ok: false,
    latency_ms: 10,
    ...over,
  });

  it("treats only a quota refusal of the primary as rate-limited", () => {
    // The eval's own burst: primary refused, a fallback answered. Not scored.
    expect(
      primaryRateLimited([
        call({ error_class: "quota" }),
        call({ model: "gemini-2.5-flash", fallback: true, ok: true }),
      ]),
    ).toBeDefined();
    // A primary that is gone (auth) is real routing degradation: scored, and
    // --strict-routing fails on the fallback that served it.
    expect(primaryRateLimited([call({ error_class: "auth" })])).toBeUndefined();
    // A fallback's quota is not the primary's.
    expect(
      primaryRateLimited([
        call({ error_class: "auth" }),
        call({ fallback: true, error_class: "quota" }),
      ]),
    ).toBeUndefined();
  });
});
