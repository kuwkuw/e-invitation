import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ZodError, type ZodType } from "zod";
import { BYOK_FALLBACK_MODELS, MODEL_PROVIDERS, TASK_ROUTES, type Task } from "./routing.js";
import { completeCompat, ProviderHttpError } from "./openaiCompat.js";
import { estimateCostUsd } from "./pricing.js";
import type { ByokProvider } from "../schemas.js";

// Anthropic models go through the SDK directly; every other provider through
// the in-process OpenAI-compat adapter (openaiCompat.ts, adr-007). Created
// lazily so the server can boot (and /healthz respond) without credentials —
// a missing ANTHROPIC_API_KEY throws here inside the walk, classifying as a
// fast local auth failure, and the walker moves on.
let clientInstance: Anthropic | null = null;
function client(): Anthropic {
  clientInstance ??= new Anthropic();
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

// Terminal-error classes: carried per model in logs and in the 502 body so a
// failed generation is diagnosable from the API response alone (quota vs bad
// key vs provider outage vs unusable output). Born of a prod incident where
// three identical 502s had three different causes.
export type FailureClass = "auth" | "quota" | "connectivity" | "output-invalid" | "other";

export interface ModelFailure {
  model: string;
  class: FailureClass;
  message: string;
}

export class AllModelsFailedError extends Error {
  constructor(
    public readonly task: Task,
    public readonly causes: ModelFailure[],
  ) {
    super(
      `All models failed for task "${task}": ${causes
        .map((c) => `${c.model} (${c.class})`)
        .join(", ")}`,
    );
    this.name = "AllModelsFailedError";
  }
}

export function classifyError(error: unknown): FailureClass {
  if (error instanceof Anthropic.APIConnectionError) return "connectivity";
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 429) return "quota";
    return "other";
  }
  // Same mapping for the OpenAI-compat transport's HTTP failures.
  if (error instanceof ProviderHttpError) {
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 429) return "quota";
    return "other";
  }
  // fetch: network failure surfaces as TypeError, timeout as a DOMException
  // named TimeoutError (AbortSignal.timeout) or AbortError.
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "connectivity";
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) return "connectivity";
  // The model answered but its output was unusable: zod rejection, broken
  // JSON, or the gateway's own empty-output / no-JSON errors below.
  if (error instanceof ZodError || error instanceof SyntaxError) return "output-invalid";
  if (error instanceof Error) {
    if (/^(empty output|no JSON object)/.test(error.message)) return "output-invalid";
    // Missing key: both transports throw locally, before any request.
    if (/api key|apiKey|authentication/i.test(error.message)) return "auth";
  }
  return "other";
}

/** The BYOK-able provider of a routed model; null for operator-side-only
 *  transports (groq, ollama), which are never part of a BYOK walk. */
export function providerOf(model: string): ByokProvider | null {
  const provider = MODEL_PROVIDERS[model];
  if (provider === "anthropic" || provider === "gemini" || provider === "openai") return provider;
  return null;
}

/** The models completeJson will walk for a task: the full route normally; a
 *  BYOK request is restricted to the key's provider so it can never fall
 *  back onto operator keys (ADR-006). When the free-first route carries no
 *  model from that provider, the provider's BYOK fallback list applies. */
export function modelsForWalk(task: Task, byok?: ByokKey): string[] {
  const route = TASK_ROUTES[task];
  const models = [route.primary, ...route.fallbacks];
  if (!byok) return models;
  const own = models.filter((model) => providerOf(model) === byok.provider);
  return own.length > 0 ? own : BYOK_FALLBACK_MODELS[byok.provider];
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
  error_class?: FailureClass;
}

function logLlm(line: LlmLogLine): void {
  // One JSON line per LLM request — the observability contract from the spec:
  // task, model, cost, latency (regenerate-rate lives in metrics.ts).
  console.log(JSON.stringify({ evt: "llm_request", ...line }));
}

// Anthropic structured outputs return pure JSON, but other providers
// sometimes wrap it in prose despite the schema. Parse leniently: exact JSON
// first, then the outermost {...} span.
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

interface AttemptResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

// One request to one model, on whichever transport its provider uses. A BYOK
// key is spent directly: as a per-request Anthropic client, or as the bearer
// token of the OpenAI-compat call (the walk already guarantees the model
// belongs to the key's provider).
async function attempt<T>(
  model: string,
  spec: CompletionSpec<T>,
  maxTokens: number,
  byok?: ByokKey,
): Promise<AttemptResult> {
  const provider = MODEL_PROVIDERS[model];
  if (!provider) throw new Error(`no provider mapped for model "${model}"`);

  if (provider === "anthropic") {
    const llm = byok?.provider === "anthropic" ? new Anthropic({ apiKey: byok.key }) : client();
    const response = await llm.messages.create({
      model,
      max_tokens: maxTokens,
      system: spec.system,
      messages: [{ role: "user", content: spec.user }],
      output_config: { format: zodOutputFormat(spec.schema) },
    });
    return {
      text: response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(""),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    };
  }

  return completeCompat({
    provider,
    model,
    system: spec.system,
    user: spec.user,
    maxTokens,
    schema: spec.schema,
    apiKey: byok?.provider === provider ? byok.key : undefined,
  });
}

/**
 * Run one structured-output completion for a task, walking the routing table
 * (primary, then fallbacks) until a model succeeds. The response is validated
 * against the given zod schema (sent to the model as structured-output
 * format, enforced locally via lenient extraction so prose-wrapping models
 * still parse). A BYOK request walks only the key's provider's models and
 * spends the caller's key, never the operator's.
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
  const causes: ModelFailure[] = [];

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
      const result = await attempt(model, spec, route.maxTokens, byok);
      const latency_ms = Math.round(performance.now() - startedAt);
      if (!result.text) {
        throw new Error(`empty output (stop_reason: ${result.stopReason})`);
      }
      const parsed = spec.schema.parse(extractJson(result.text));
      logLlm({
        ...base,
        ok: true,
        latency_ms,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: estimateCostUsd(model, {
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
        }),
      });
      return parsed;
    } catch (error) {
      const error_class = classifyError(error);
      const message = error instanceof Error ? error.message : String(error);
      logLlm({
        ...base,
        ok: false,
        latency_ms: Math.round(performance.now() - startedAt),
        error: message,
        error_class,
      });
      causes.push({ model, class: error_class, message });
    }
  }

  throw new AllModelsFailedError(task, causes);
}
