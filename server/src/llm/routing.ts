// Task-based routing table: task -> primary model -> fallbacks.
// This is the single operator switch point — change models here, nowhere else.
// Every model listed must have an entry in pricing.ts and MODEL_PROVIDERS
// (both enforced by test/routing.test.ts).

import type { ByokProvider } from "../schemas.js";

export type Task =
  | "brief_extraction"
  | "copy_generation"
  | "design_resolution"
  | "field_regeneration";

export interface Route {
  primary: string;
  fallbacks: string[];
  /** Hard output cap per request for this task. */
  maxTokens: number;
}

/** Transport for each routed model (adr-007): "anthropic" goes through the
 *  Anthropic SDK; every other provider through the in-process OpenAI-compat
 *  adapter (openaiCompat.ts). "groq" and "ollama" are operator-side only —
 *  never part of a BYOK walk. */
export type Provider = "anthropic" | "gemini" | "openai" | "groq" | "ollama";

export const MODEL_PROVIDERS: Record<string, Provider> = {
  "claude-opus-4-8": "anthropic",
  "claude-sonnet-5": "anthropic",
  "claude-haiku-4-5": "anthropic",
  "gemini-2.5-flash": "gemini",
  "gemini-2.5-pro": "gemini",
  "gpt-5.1": "openai",
  "gpt-5-mini": "openai",
  "llama-3.3-70b-versatile": "groq",
  "gemma3-4b": "ollama",
};

/** Models a BYOK walk uses when the task's route contains none from the
 *  key's provider (free-first routing dropped OpenAI from the default
 *  routes, but a host bringing an OpenAI key still gets that provider). */
export const BYOK_FALLBACK_MODELS: Record<ByokProvider, string[]> = {
  anthropic: ["claude-sonnet-5", "claude-haiku-4-5"],
  gemini: ["gemini-2.5-flash"],
  openai: ["gpt-5.1", "gpt-5-mini"],
};

// Free-tier-first for the MVP (adr-007): primaries cost the operator nothing.
// Groq's free tier (~1k req/day) absorbs volume; the Gemini free tier
// (~20 req/day observed — one generation is 3 calls) is saved for the two
// copy-quality tasks, where gemini-2.5-flash writes the best free Ukrainian.
// Paid Claude models stay as fallbacks: without ANTHROPIC_API_KEY they fail
// instantly (local auth error, no network) and the walker moves on; with a
// key they engage when the free tiers are down or out of quota.
export const TASK_ROUTES: Record<Task, Route> = {
  // Cheap, fast structured extraction (per spec: brief uses a cheap model).
  brief_extraction: {
    primary: "llama-3.3-70b-versatile",
    fallbacks: ["gemini-2.5-flash", "claude-haiku-4-5", "gemma3-4b"],
    maxTokens: 1024,
  },
  // Quality-sensitive: the invitation text is the product.
  copy_generation: {
    primary: "gemini-2.5-flash",
    fallbacks: ["llama-3.3-70b-versatile", "claude-sonnet-5", "gemma3-4b"],
    maxTokens: 2048,
  },
  // Enum picking — small output. If the ~3s target is missed, this is the
  // first candidate to downgrade.
  design_resolution: {
    primary: "llama-3.3-70b-versatile",
    fallbacks: ["gemini-2.5-flash", "claude-haiku-4-5", "gemma3-4b"],
    maxTokens: 256,
  },
  field_regeneration: {
    primary: "gemini-2.5-flash",
    fallbacks: ["llama-3.3-70b-versatile", "claude-sonnet-5", "gemma3-4b"],
    maxTokens: 512,
  },
};
