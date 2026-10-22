// LLM eval: runs the real pipeline against real providers and checks the
// output. `pnpm --filter inv-app-server eval [-- flags]`
//
//   --generate N       full pipeline on the N highest-ranked cases (default 6;
//                      copy runs on Gemini's ~20/day free tier, so keep it small)
//   --only <a,b>       run only these case ids
//   --model <id>       pin every task to one routed model, no fallbacks —
//                      for trying a replacement before changing routing.ts
//   --concurrency N    parallel cases (default 1)
//   --pace-ms N        minimum gap between case starts (default 8000): the
//                      free tiers limit tokens and requests *per minute*, and
//                      a run that bursts measures the limit, not the prompts
//   --retries N        retries for a case whose primary model was rate-limited
//                      (default 3), waiting as long as the provider asks
//   --max-unscored 0.1 share of cases still rate-limited after retries above
//                      which the run fails as inconclusive
//   --min-brief 0.9    pass rate below which the run fails
//   --min-copy 0.85
//   --strict-routing   fail if any call was served by a fallback model
//   --out <file>       write the JSON report there
//
// Exit codes: 0 pass, 1 below threshold / routing degraded, 2 cannot run.

import "dotenv/config";
import { AllModelsFailedError } from "../src/llm/gateway.js";
import { MODEL_PROVIDERS, TASK_ROUTES } from "../src/llm/routing.js";
import { extractBrief } from "../src/pipeline/brief.js";
import { generateInvitation } from "../src/pipeline/generate.js";
import type { EventBrief, Invitation } from "../src/schemas.js";
import { CASES, type EvalCase } from "./cases.js";
import { type CheckResult, checkBrief, checkCopy } from "./checks.js";
import {
  captureGatewayLogs,
  type LlmCall,
  PROVIDER_KEY_ENV,
  pacer,
  parseArgs,
  percentile,
  pinRoutes,
  primaryRateLimited,
  publish,
  retryHintMs,
  withCalls,
} from "./harness.js";

interface CaseResult {
  id: string;
  input: string;
  generated: boolean;
  brief: CheckResult[];
  copy: CheckResult[];
  error?: string;
  /** Still rate-limited on the primary after every retry: not scored. */
  rateLimited?: boolean;
  /** Attempts discarded because the primary was rate-limited. */
  retries: number;
  calls: LlmCall[];
  output?: unknown;
}

const args = parseArgs(process.argv.slice(2));
const num = (key: string, fallback: number) =>
  typeof args[key] === "string" ? Number(args[key]) : fallback;

const generateCount = num("generate", 6);
const concurrency = Math.max(1, num("concurrency", 1));
const pace = pacer(Math.max(0, num("pace-ms", 8000)));
const maxRetries = Math.max(0, num("retries", 3));
const maxUnscored = num("max-unscored", 0.1);
const minBrief = num("min-brief", 0.9);
const minCopy = num("min-copy", 0.85);
const strictRouting = args["strict-routing"] === true;
const pinned = typeof args.model === "string" ? args.model : undefined;

function selectCases(): { cases: EvalCase[]; generate: Set<string> } {
  let cases = CASES;
  if (typeof args.only === "string") {
    const ids = new Set(args.only.split(","));
    cases = CASES.filter((c) => ids.has(c.id));
    const unknown = [...ids].filter((id) => !CASES.some((c) => c.id === id));
    if (unknown.length) throw new Error(`unknown case id(s): ${unknown.join(", ")}`);
  }
  const ranked = cases
    .filter((c) => c.generateRank !== undefined)
    .sort((a, b) => (a.generateRank ?? 0) - (b.generateRank ?? 0))
    .slice(0, generateCount);
  return { cases, generate: new Set(ranked.map((c) => c.id)) };
}

function describeError(error: unknown): string {
  if (error instanceof AllModelsFailedError) {
    return `all models failed: ${error.causes.map((c) => `${c.model} (${c.class})`).join(", ")}`;
  }
  return error instanceof Error ? error.message : String(error);
}

interface Output {
  brief: EventBrief;
  invitation?: Invitation;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait the provider's hint (plus a margin), or back off when it gave none. */
function backoffMs(limited: LlmCall, attempt: number): number {
  const hint = limited.error ? retryHintMs(limited.error) : null;
  return Math.min(65_000, hint !== null ? hint + 1_000 : 15_000 * (attempt + 1));
}

async function attemptCase(c: EvalCase, full: boolean) {
  await pace();
  return withCalls(async (): Promise<Output> => {
    if (!full) return { brief: await extractBrief(c.input) };
    const invitation = await generateInvitation(c.input);
    return { brief: invitation.brief, invitation };
  });
}

async function runCase(c: EvalCase, full: boolean): Promise<CaseResult> {
  let run = await attemptCase(c, full);
  let retries = 0;
  for (let limited = primaryRateLimited(run.calls); limited && retries < maxRetries; ) {
    const wait = backoffMs(limited, retries);
    process.stderr.write(
      `  ⏸ ${c.id}: ${limited.model} rate-limited, retrying in ${Math.round(wait / 1000)}s\n`,
    );
    await sleep(wait);
    retries++;
    run = await attemptCase(c, full);
    limited = primaryRateLimited(run.calls);
  }
  const { value, error, calls } = run;
  const result: CaseResult = {
    id: c.id,
    input: c.input,
    generated: full,
    brief: [],
    copy: [],
    retries,
    calls,
  };
  if (primaryRateLimited(calls)) result.rateLimited = true;
  if (error || !value) {
    result.error = describeError(error);
    return result;
  }
  result.output = value.invitation ?? value.brief;
  result.brief = checkBrief(value.brief, c.expect);
  if (value.invitation) result.copy = checkCopy(c.input, value.invitation);
  return result;
}

async function runAll(cases: EvalCase[], generate: Set<string>): Promise<CaseResult[]> {
  const results: CaseResult[] = new Array(cases.length);
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const i = next++;
      const c = cases[i] as EvalCase;
      results[i] = await runCase(c, generate.has(c.id));
      const r = results[i] as CaseResult;
      const ok = !r.error && [...r.brief, ...r.copy].every((x) => x.pass);
      const mark = r.rateLimited ? "⏸" : ok ? "✓" : "✗";
      process.stderr.write(`${mark} ${c.id}${r.error ? ` — ${r.error}` : ""}\n`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const passed = (checks: CheckResult[], error?: string) => !error && checks.every((c) => c.pass);

const tally = (keys: string[]) => {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort().map(([key, n]) => `- ${key}: ${n}`);
};

function summarize(all: CaseResult[]) {
  // A case still rate-limited after its retries says nothing about the
  // prompt, and its fallback answer is not what the run set out to measure:
  // it is counted, not scored.
  const unscored = all.filter((r) => r.rateLimited);
  const results = all.filter((r) => !r.rateLimited);
  const calls = results.flatMap((r) => r.calls);
  const okCalls = calls.filter((c) => c.ok);
  const generated = results.filter((r) => r.generated);
  const briefPass = results.filter((r) => passed(r.brief, r.error)).length;
  const copyPass = generated.filter((r) => passed(r.copy, r.error)).length;
  return {
    brief: {
      passed: briefPass,
      total: results.length,
      rate: results.length ? briefPass / results.length : 1,
      min: minBrief,
    },
    copy: {
      passed: copyPass,
      total: generated.length,
      rate: generated.length ? copyPass / generated.length : 1,
      min: minCopy,
    },
    unscored: {
      count: unscored.length,
      total: all.length,
      rate: all.length ? unscored.length / all.length : 0,
      max: maxUnscored,
      ids: unscored.map((r) => r.id),
    },
    retries: all.reduce((n, r) => n + r.retries, 0),
    fallbacks: okCalls.filter((c) => c.fallback).length,
    calls: okCalls.length,
    cost_usd: okCalls.reduce((sum, c) => sum + (c.cost_usd ?? 0), 0),
    okCalls,
    failedCalls: calls.filter((c) => !c.ok && !c.retried),
  };
}

type Summary = ReturnType<typeof summarize>;

const pct = (x: number) => `${Math.round(x * 100)}%`;

function headline(s: Summary): string[] {
  const row = (label: string, r: Summary["brief"]) =>
    r.total === 0
      ? `| ${label} | — none scored | ${pct(r.min)} |`
      : `| ${label} | ${r.rate >= r.min ? "✅" : "❌"} ${r.passed}/${r.total} (${pct(r.rate)}) | ${pct(r.min)} |`;
  return [
    `## LLM eval${pinned ? ` — pinned to \`${pinned}\`` : ""}`,
    "",
    "| | Result | Threshold |",
    "|---|---|---|",
    row("Brief extraction", s.brief),
    row("Full generation", s.copy),
    unscoredRow(s),
    `| Served by a fallback | ${s.fallbacks ? "⚠️" : "✅"} ${s.fallbacks} of ${s.calls} calls | ${strictRouting ? "0 (strict)" : "reported"} |`,
    `| Cost | $${s.cost_usd.toFixed(4)} | |`,
  ];
}

function unscoredRow(s: Summary): string {
  const u = s.unscored;
  const icon = u.rate > u.max ? "❌" : u.count ? "⚠️" : "✅";
  return `| Rate-limited, not scored | ${icon} ${u.count}/${u.total} (${s.retries} retries) | ≤ ${pct(u.max)} |`;
}

function unscoredSection(s: Summary): string[] {
  if (!s.unscored.count) return [];
  return [
    "",
    `**Rate-limited, not scored (${s.unscored.count})**: provider limits, not prompt quality: ${s.unscored.ids.join(", ")}`,
  ];
}

function routingSection(s: Summary): string[] {
  const lines = [
    "",
    "**Served by**",
    "",
    ...tally(s.okCalls.map((c) => `${c.task} → ${c.model}${c.fallback ? " (fallback)" : ""}`)),
  ];
  if (s.failedCalls.length) {
    lines.push("", "**Failed attempts before a model answered**", "");
    lines.push(...tally(s.failedCalls.map((c) => `${c.model}: ${c.error_class}`)));
  }
  lines.push(
    "",
    "**Latency (ms, successful calls)**",
    "",
    "| Task | p50 | p95 | n |",
    "|---|---|---|---|",
  );
  for (const task of Object.keys(TASK_ROUTES)) {
    const l = s.okCalls.filter((c) => c.task === task).map((c) => c.latency_ms);
    if (l.length)
      lines.push(`| ${task} | ${percentile(l, 50)} | ${percentile(l, 95)} | ${l.length} |`);
  }
  return lines;
}

function failureSection(results: CaseResult[]): string[] {
  const failures = results.filter(
    (r) => !r.rateLimited && !passed([...r.brief, ...r.copy], r.error),
  );
  if (!failures.length) return [];
  return [
    "",
    `**Failures (${failures.length})**`,
    "",
    ...failures.map((r) => {
      const bad = [...r.brief, ...r.copy].filter((c) => !c.pass);
      const why = r.error ?? bad.map((c) => `\`${c.check}\` ${c.detail ?? ""}`.trim()).join("; ");
      return `- **${r.id}** — ${why}`;
    }),
  ];
}

function report(results: CaseResult[]) {
  const s = summarize(results);
  const fail =
    s.brief.rate < s.brief.min ||
    s.copy.rate < s.copy.min ||
    s.unscored.rate > s.unscored.max ||
    (strictRouting && s.fallbacks > 0);
  const { okCalls: _ok, failedCalls: _failed, ...summary } = s;
  return {
    markdown: [
      ...headline(s),
      ...unscoredSection(s),
      ...routingSection(s),
      ...failureSection(results),
    ].join("\n"),
    fail,
    json: { pinned: pinned ?? null, summary, results },
  };
}

async function main(): Promise<number> {
  if (pinned) {
    const provider = MODEL_PROVIDERS[pinned];
    if (!provider) {
      console.error(`--model ${pinned}: not in MODEL_PROVIDERS (routing.ts)`);
      return 2;
    }
    pinRoutes(pinned);
  }

  // Every model a run could reach needs its provider's key, or the walk
  // records a local auth failure — real but uninformative. Require at least
  // the primaries' keys so a misconfigured run says so instead of "failing".
  const primaries = pinned ? [pinned] : Object.values(TASK_ROUTES).map((r) => r.primary);
  const missing = [...new Set(primaries.map((m) => MODEL_PROVIDERS[m] ?? "?"))]
    .map((p) => PROVIDER_KEY_ENV[p])
    .filter((env): env is string => Boolean(env) && !process.env[env as string]);
  if (missing.length) {
    console.error(`Cannot run: ${missing.join(", ")} not set (needed by the primary models).`);
    return 2;
  }

  captureGatewayLogs();
  const { cases, generate } = selectCases();
  process.stderr.write(
    `Running ${cases.length} cases (${generate.size} with full generation), concurrency ${concurrency}\n`,
  );
  const results = await runAll(cases, generate);
  const { markdown, fail, json } = report(results);
  publish(markdown, typeof args.out === "string" ? args.out : undefined, json);
  return fail ? 1 : 0;
}

process.exitCode = await main();
