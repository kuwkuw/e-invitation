import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { TASK_ROUTES, type Task } from "./routing.js";
import { estimateCostUsd } from "./pricing.js";

// Single client for the whole process, created lazily so the server can boot
// (and /healthz respond) without credentials. To route through a LiteLLM Proxy
// later (multi-provider / BYOK), set LLM_BASE_URL — the routing table and this
// interface stay unchanged.
let clientInstance: Anthropic | null = null;
function client(): Anthropic {
  clientInstance ??= new Anthropic(
    process.env.LLM_BASE_URL ? { baseURL: process.env.LLM_BASE_URL } : undefined,
  );
  return clientInstance;
}

export interface CompletionSpec<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
}

interface LlmLogLine {
  ts: string;
  task: Task;
  model: string;
  fallback: boolean;
  ok: boolean;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number | null;
  error?: string;
}

function logLlm(line: LlmLogLine): void {
  // One JSON line per LLM request — the observability contract from the spec:
  // task, model, cost, latency (regenerate-rate lives in metrics.ts).
  console.log(JSON.stringify({ evt: "llm_request", ...line }));
}

/**
 * Run one structured-output completion for a task, walking the routing table
 * (primary, then fallbacks) until a model succeeds. The response is validated
 * against the given zod schema via Anthropic structured outputs.
 */
export async function completeJson<T>(task: Task, spec: CompletionSpec<T>): Promise<T> {
  const route = TASK_ROUTES[task];
  const models = [route.primary, ...route.fallbacks];
  let lastError: unknown;

  for (const model of models) {
    const startedAt = performance.now();
    const base = {
      ts: new Date().toISOString(),
      task,
      model,
      fallback: model !== route.primary,
    };
    try {
      const response = await client().messages.parse({
        model,
        max_tokens: route.maxTokens,
        system: spec.system,
        messages: [{ role: "user", content: spec.user }],
        output_config: { format: zodOutputFormat(spec.schema) },
      });
      const latency_ms = Math.round(performance.now() - startedAt);
      if (response.parsed_output == null) {
        throw new Error(`unparseable output (stop_reason: ${response.stop_reason})`);
      }
      logLlm({
        ...base,
        ok: true,
        latency_ms,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cost_usd: estimateCostUsd(model, response.usage),
      });
      return response.parsed_output;
    } catch (error) {
      logLlm({
        ...base,
        ok: false,
        latency_ms: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      lastError = error;
    }
  }

  throw new Error(
    `All models failed for task "${task}" (tried: ${models.join(", ")}): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
