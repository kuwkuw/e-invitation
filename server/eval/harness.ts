// Plumbing shared by the eval and the probe: capturing the gateway's own
// per-request log lines, pinning the routing table to one model, and
// writing a report where CI shows it.

import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, writeFileSync } from "node:fs";
import type { FailureClass } from "../src/llm/gateway.js";
import { type Route, TASK_ROUTES, type Task } from "../src/llm/routing.js";

/** One `llm_request` line, as gateway.ts logs it. */
export interface LlmCall {
  task: Task;
  model: string;
  fallback: boolean;
  ok: boolean;
  latency_ms: number;
  cost_usd?: number | null;
  error_class?: FailureClass;
  error?: string;
  retried?: boolean;
}

const scope = new AsyncLocalStorage<LlmCall[]>();
const unscoped: LlmCall[] = [];
let installed = false;

/** Route the gateway's `console.log` JSON lines into whichever `withCalls`
 *  scope made the request. The gateway's log line is already the record of
 *  which model served and whether it was a fallback, so the eval reads it
 *  rather than adding a second channel to production code. Anything that is
 *  not an llm_request line still prints. */
export function captureGatewayLogs(): void {
  if (installed) return;
  installed = true;
  const original = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const [first] = args;
    if (
      args.length === 1 &&
      typeof first === "string" &&
      first.startsWith('{"evt":"llm_request"')
    ) {
      try {
        const call = JSON.parse(first) as LlmCall;
        (scope.getStore() ?? unscoped).push(call);
        return;
      } catch {
        // fall through and print it
      }
    }
    original(...args);
  };
}

export async function withCalls<T>(
  run: () => Promise<T>,
): Promise<{ value?: T; error?: unknown; calls: LlmCall[] }> {
  const calls: LlmCall[] = [];
  try {
    const value = await scope.run(calls, run);
    return { value, calls };
  } catch (error) {
    return { error, calls };
  }
}

/** Point every task (or one) at a single model with no fallbacks, so a run
 *  measures that model rather than whichever one the walk lands on. Returns
 *  the function that restores the table. */
export function pinRoutes(model: string, tasks: Task[] = Object.keys(TASK_ROUTES) as Task[]) {
  const saved = new Map<Task, Route>();
  for (const task of tasks) {
    saved.set(task, { ...TASK_ROUTES[task] });
    TASK_ROUTES[task] = { ...TASK_ROUTES[task], primary: model, fallbacks: [] };
  }
  return () => {
    for (const [task, route] of saved) TASK_ROUTES[task] = route;
  };
}

/** How long a provider asked us to wait, read from its 429 body. Groq says
 *  "Please try again in 7.66s" (or "in 1m3.2s"); Gemini says
 *  "Please retry in 41.2s". Null when no hint is given. */
export function retryHintMs(message: string): number | null {
  const m = /(?:try again|retry) in\s+(?:(\d+)m)?\s*(\d+(?:\.\d+)?)\s*(ms|s)\b/i.exec(message);
  if (!m) return null;
  const minutes = m[1] ? Number(m[1]) : 0;
  const value = Number(m[2]);
  return Math.ceil(minutes * 60_000 + (m[3]?.toLowerCase() === "ms" ? value : value * 1000));
}

/** The primary model was refused for quota: the eval's own traffic, or a
 *  provider limit, not a property of the prompt. A fallback that answered
 *  after it is not what the run set out to measure. */
export function primaryRateLimited(calls: LlmCall[]): LlmCall | undefined {
  return calls.find((c) => !c.ok && !c.fallback && c.error_class === "quota");
}

/** Spaces out the starts of requests across workers, so a run stays under a
 *  per-minute limit instead of discovering it. */
export function pacer(intervalMs: number) {
  let nextSlot = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + intervalMs;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };
}

/** Operator key per provider, the same env vars /healthz reports. */
export const PROVIDER_KEY_ENV: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  ollama: "OLLAMA_BASE_URL",
};

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

/** Print the markdown, and hand it to the GitHub job summary when there is one. */
export function publish(markdown: string, jsonPath: string | undefined, json: unknown): void {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
}

/** Tiny `--flag value` parser; flags without a value are `true`. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[arg.slice(2)] = next;
      i++;
    } else {
      out[arg.slice(2)] = true;
    }
  }
  return out;
}
