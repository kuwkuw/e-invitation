// Model reachability probe: one tiny structured-output request to every model
// in the routing table, through the real gateway path.
// `pnpm --filter inv-app-server probe [-- --strict]`
//
// /healthz reports a provider from *key presence*; it cannot see a model that
// was moved to a paid tier or retired. That is what happened on 2026-09-12:
// Groq moved llama-3.3-70b-versatile behind a paid tier, both volume tasks
// fell through to Gemini's ~20/day tier, and nothing said so. This asks each
// model directly.
//
// A failing primary fails the run (exit 1): production is degraded right now.
// A failing fallback is reported and only fails under --strict. Models whose
// provider has no key here are skipped — except a primary, which fails,
// because production would be in the same position.

import "dotenv/config";
import { z } from "zod";
import { AllModelsFailedError, completeJson } from "../src/llm/gateway.js";
import { MODEL_PROVIDERS, TASK_ROUTES, type Task } from "../src/llm/routing.js";
import {
  captureGatewayLogs,
  PROVIDER_KEY_ENV,
  parseArgs,
  pinRoutes,
  publish,
  withCalls,
} from "./harness.js";

const args = parseArgs(process.argv.slice(2));
const strict = args.strict === true;

const Pong = z.object({ ok: z.boolean() });

type Outcome = "ok" | "failed" | "skipped";
interface ProbeResult {
  model: string;
  provider: string;
  primaryFor: Task[];
  fallbackFor: Task[];
  outcome: Outcome;
  latency_ms?: number;
  detail?: string;
}

async function probe(model: string): Promise<Omit<ProbeResult, "primaryFor" | "fallbackFor">> {
  const provider = MODEL_PROVIDERS[model] ?? "?";
  const env = PROVIDER_KEY_ENV[provider];
  if (env && !process.env[env])
    return { model, provider, outcome: "skipped", detail: `${env} not set` };

  // The smallest-capped task, pinned to this model alone, so the request
  // takes exactly the transport and structured-output path production does.
  const restore = pinRoutes(model, ["design_resolution"]);
  try {
    const { error, calls } = await withCalls(() =>
      completeJson("design_resolution", {
        system: "You are a health check. Reply with JSON only.",
        user: 'Return {"ok": true}.',
        schema: Pong,
      }),
    );
    const last = calls.at(-1);
    if (!error) return { model, provider, outcome: "ok", latency_ms: last?.latency_ms };
    const cause = error instanceof AllModelsFailedError ? error.causes[0] : undefined;
    return {
      model,
      provider,
      outcome: "failed",
      latency_ms: last?.latency_ms,
      detail: cause ? `${cause.class}: ${cause.message.slice(0, 160)}` : String(error),
    };
  } finally {
    restore();
  }
}

async function main(): Promise<number> {
  captureGatewayLogs();
  const roles = new Map<string, { primaryFor: Task[]; fallbackFor: Task[] }>();
  for (const [task, route] of Object.entries(TASK_ROUTES) as [Task, (typeof TASK_ROUTES)[Task]][]) {
    for (const model of [route.primary, ...route.fallbacks]) {
      const r = roles.get(model) ?? { primaryFor: [], fallbackFor: [] };
      (model === route.primary ? r.primaryFor : r.fallbackFor).push(task);
      roles.set(model, r);
    }
  }

  const results: ProbeResult[] = [];
  for (const [model, role] of roles) {
    results.push({ ...(await probe(model)), ...role });
  }

  const primaryDown = results.filter((r) => r.primaryFor.length > 0 && r.outcome !== "ok");
  const fallbackDown = results.filter((r) => r.primaryFor.length === 0 && r.outcome === "failed");

  const icon: Record<Outcome, string> = { ok: "✅", failed: "❌", skipped: "⏭️" };
  const lines = [
    "## Model reachability",
    "",
    "| Model | Provider | Role | Result | Latency | Detail |",
    "|---|---|---|---|---|---|",
    ...results.map((r) => {
      const role = r.primaryFor.length
        ? `**primary**: ${r.primaryFor.join(", ")}`
        : `fallback: ${r.fallbackFor.join(", ")}`;
      const latency = r.latency_ms === undefined ? "" : `${r.latency_ms} ms`;
      return `| \`${r.model}\` | ${r.provider} | ${role} | ${icon[r.outcome]} | ${latency} | ${r.detail ?? ""} |`;
    }),
  ];
  if (primaryDown.length) {
    lines.push(
      "",
      `❌ **${primaryDown.length} primary model(s) unreachable** — production is running on fallbacks for: ${[
        ...new Set(primaryDown.flatMap((r) => r.primaryFor)),
      ].join(", ")}. Check \`/v1/models\` with the operator key and update \`routing.ts\`.`,
    );
  }

  publish(lines.join("\n"), typeof args.out === "string" ? args.out : undefined, { results });
  return primaryDown.length > 0 || (strict && fallbackDown.length > 0) ? 1 : 0;
}

process.exitCode = await main();
