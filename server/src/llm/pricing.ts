// USD per million tokens, used for per-request cost logging.
// Must cover every model referenced in routing.ts (enforced by test/routing.test.ts).
export const MODEL_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
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
