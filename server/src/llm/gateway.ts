import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { TASK_ROUTES, type Task } from "./routing.js";
import { estimateCostUsd } from "./pricing.js";
import type { ByokProvider } from "../schemas.js";

// Single client for the whole process, created lazily so the server can boot
// (and /healthz respond) without credentials. To route through a LiteLLM Proxy
// later (multi-provider / BYOK), set LLM_BASE_URL — the routing table and this
// interface stay unchanged.
let clientInstance: Anthropic | null = null;
function client(): Anthropic {
  // Behind the proxy the SDK still demands an api key; LiteLLM without auth
  // ignores the value, so a placeholder keeps direct-mode behavior unchanged.
  clientInstance ??= new Anthropic(
    process.env.LLM_BASE_URL
      ? {
          baseURL: process.env.LLM_BASE_URL,
          apiKey: process.env.ANTHROPIC_API_KEY || "litellm-local",
        }
      : undefined,
  );
  return clientInstance;
}

export interface CompletionSpec<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
}

/** BYOK (ADR-006): the host's own provider key, valid for one request.
 *  Never stored, never logged — log lines carry only `byok: true`. */
export interface ByokKey {
  provider: ByokProvider;
  key: string;
}

// Routed model ids encode their provider by prefix; "gemma3-4b" (local
// Ollama) maps to none of them and is never part of a BYOK walk.
export function providerOf(model: string): ByokProvider | null {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("gpt-")) return "openai";
  return null;
}

/** The models completeJson will walk for a task: the full route normally; a
 *  BYOK request is restricted to the key's provider so it can never fall
 *  back onto operator keys (ADR-006). */
export function modelsForWalk(task: Task, byok?: ByokKey): string[] {
  const route = TASK_ROUTES[task];
  const models = [route.primary, ...route.fallbacks];
  if (!byok) return models;
  return models.filter((model) => providerOf(model) === byok.provider);
}

interface LlmLogLine {
  ts: string;
  task: Task;
  model: string;
  fallback: boolean;
  byok?: boolean;
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

// Anthropic structured outputs return pure JSON, but proxied providers
// (Gemini via LiteLLM) sometimes wrap it in prose despite the schema.
// Parse leniently: exact JSON first, then the outermost {...} span.
function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error(`no JSON object in output: ${text.slice(0, 80)}`);
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

// The transport for one request. Anthropic BYOK keys go direct with a
// per-request client (no proxy involvement). Gemini/OpenAI BYOK keys ride
// the proxy client plus a per-request `api_key` body override — LiteLLM's
// client-side credentials, enabled per model in litellm/config.yaml and
// verified to pass through the Anthropic-format endpoint (spike 2026-07-20).
function clientFor(byok?: ByokKey): { client: Anthropic; bodyExtra?: { api_key: string } } {
  if (!byok) return { client: client() };
  if (byok.provider === "anthropic") {
    return { client: new Anthropic({ apiKey: byok.key }) };
  }
  if (!process.env.LLM_BASE_URL) {
    throw new Error(`BYOK provider "${byok.provider}" requires the LiteLLM proxy (LLM_BASE_URL).`);
  }
  return { client: client(), bodyExtra: { api_key: byok.key } };
}

/**
 * Run one structured-output completion for a task, walking the routing table
 * (primary, then fallbacks) until a model succeeds. The response is validated
 * against the given zod schema (sent to the model as an Anthropic
 * structured-output format, enforced locally via lenient extraction so
 * prose-wrapping proxied models still parse). A BYOK request walks only the
 * key's provider's models and spends the caller's key, never the operator's.
 */
export async function completeJson<T>(
  task: Task,
  spec: CompletionSpec<T>,
  byok?: ByokKey,
): Promise<T> {
  const route = TASK_ROUTES[task];
  const models = modelsForWalk(task, byok);
  if (models.length === 0) {
    throw new Error(`No routed models for BYOK provider "${byok?.provider}" on task "${task}".`);
  }
  let lastError: unknown;

  for (const model of models) {
    const startedAt = performance.now();
    const base = {
      ts: new Date().toISOString(),
      task,
      model,
      fallback: model !== route.primary,
      ...(byok ? { byok: true } : {}),
    };
    try {
      const { client: llm, bodyExtra } = clientFor(byok);
      const response = await llm.messages.create({
        model,
        max_tokens: route.maxTokens,
        system: spec.system,
        messages: [{ role: "user", content: spec.user }],
        output_config: { format: zodOutputFormat(spec.schema) },
        // Undocumented body params pass through the SDK to the proxy.
        ...(bodyExtra as Record<string, never> | undefined),
      });
      const latency_ms = Math.round(performance.now() - startedAt);
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      if (!text) {
        throw new Error(`empty output (stop_reason: ${response.stop_reason})`);
      }
      const parsed = spec.schema.parse(extractJson(text));
      logLlm({
        ...base,
        ok: true,
        latency_ms,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cost_usd: estimateCostUsd(model, response.usage),
      });
      return parsed;
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
