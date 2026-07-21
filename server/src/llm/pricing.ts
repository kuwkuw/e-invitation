// USD per million tokens, used for per-request cost logging.
// Must cover every model referenced in routing.ts (enforced by test/routing.test.ts).
export const MODEL_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  // Groq free tier (adr-007) — $0 until a paid Groq tier is adopted.
  "llama-3.3-70b-versatile": { input: 0, output: 0 },
  // Local Ollama model — free.
  "gemma3-4b": { input: 0, output: 0 },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function estimateCostUsd(model: string, usage: UsageLike): number | null {
  const price = MODEL_PRICES_PER_MTOK[model];
  if (!price) return null;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const usd =
    (usage.input_tokens * price.input +
      cacheWrite * price.input * 1.25 +
      cacheRead * price.input * 0.1 +
      usage.output_tokens * price.output) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
