// In-process OpenAI-compatible transport (adr-007). Gemini, OpenAI, Groq and
// Ollama all expose /chat/completions endpoints in the OpenAI shape, so one
// fetch-based adapter replaces the LiteLLM Proxy sidecar (which idled at
// ~1 GiB and OOM-killed on small plans). Adding a provider is one entry in
// PROVIDERS; the gateway's routing walk, lenient JSON extraction and zod
// validation are unchanged and remain the enforcement layer.

import { z, type ZodType } from "zod";
import type { Provider } from "./routing.js";

export type CompatProvider = Exclude<Provider, "anthropic">;

/** Non-2xx provider response; classifyError maps status → failure class. */
export class ProviderHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

interface ProviderConfig {
  baseUrl: () => string;
  /** Env var holding the operator key; undefined = no key needed (Ollama). */
  envKey?: string;
}

const PROVIDERS: Record<CompatProvider, ProviderConfig> = {
  gemini: {
    baseUrl: () => "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
  },
  openai: {
    baseUrl: () => "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
  },
  groq: {
    baseUrl: () => "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
  },
  ollama: {
    baseUrl: () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  },
};

// Routed ids that differ from the provider's model name (LiteLLM used to
// alias these in config.yaml).
const MODEL_ALIASES: Record<string, string> = {
  "gemma3-4b": "gemma3:4b",
};

// Reasoning eats the small per-task maxTokens caps (design_resolution: 256)
// before any JSON is emitted, so keep it off. gpt-5-mini has no "none" tier;
// minimal is its floor. Gemini's OpenAI-compat endpoint takes google-specific
// settings under a literal `extra_body` field.
const GEMINI_NO_THINKING = {
  extra_body: { google: { thinking_config: { thinking_budget: 0 } } },
};
const MODEL_PARAMS: Record<string, Record<string, unknown>> = {
  "gpt-5.1": { reasoning_effort: "none" },
  "gpt-5-mini": { reasoning_effort: "minimal" },
  "gemini-2.5-flash": GEMINI_NO_THINKING,
  "gemini-2.5-pro": GEMINI_NO_THINKING,
};

const TIMEOUT_MS = 30_000;

export interface CompatRequest {
  provider: CompatProvider;
  /** Routed model id (MODEL_ALIASES translates where needed). */
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Sent as response_format json_schema and appended to the system prompt. */
  schema: ZodType;
  /** BYOK override; wins over the operator env key. */
  apiKey?: string;
}

export interface CompatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

export async function completeCompat(req: CompatRequest): Promise<CompatResult> {
  const config = PROVIDERS[req.provider];
  const key = req.apiKey ?? (config.envKey ? process.env[config.envKey] : "ollama");
  if (!key) {
    // Thrown before any network call so a missing operator key fails the
    // walk instantly; the message matches classifyError's auth regex.
    throw new Error(`missing ${config.envKey} (api key for provider "${req.provider}")`);
  }

  const jsonSchema = z.toJSONSchema(req.schema);
  const body: Record<string, unknown> = {
    model: MODEL_ALIASES[req.model] ?? req.model,
    max_tokens: req.maxTokens,
    messages: [
      // The schema also rides in the system prompt: providers with weak
      // json_schema support (Groq's json_object mode, Ollama) still see it,
      // and the gateway's zod validation enforces it either way.
      { role: "system", content: `${req.system}\n\nRespond with a single JSON object matching this JSON schema, and nothing else:\n${JSON.stringify(jsonSchema)}` },
      { role: "user", content: req.user },
    ],
    ...(req.provider === "gemini" || req.provider === "openai"
      ? { response_format: { type: "json_schema", json_schema: { name: "result", schema: jsonSchema } } }
      : req.provider === "groq"
        ? { response_format: { type: "json_object" } }
        : {}), // Ollama: response_format support is spotty; prompt + zod suffice.
    ...MODEL_PARAMS[req.model],
  };

  const res = await fetch(`${config.baseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new ProviderHttpError(res.status, `${req.provider} ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    stopReason: choice?.finish_reason ?? null,
  };
}
