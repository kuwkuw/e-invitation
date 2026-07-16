// Task-based routing table: task -> primary model -> fallbacks.
// This is the single operator switch point — change models here, nowhere else.
// Every model listed must have an entry in pricing.ts (enforced by test/routing.test.ts).

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

export const TASK_ROUTES: Record<Task, Route> = {
  // Gemini fallbacks resolve only through the LiteLLM proxy (LLM_BASE_URL set);
  // called directly against Anthropic they fail and the walker moves on.
  // Cheap, fast structured extraction (per spec: brief uses a cheap model).
  brief_extraction: {
    primary: "claude-haiku-4-5",
    fallbacks: ["claude-sonnet-5", "gemini-2.5-flash"],
    maxTokens: 1024,
  },
  // Quality-sensitive: the invitation text is the product.
  // (gemini-2.5-pro would fit better here but has zero free-tier quota;
  // upgrade the fallback when a paid Gemini key lands.)
  copy_generation: {
    primary: "claude-opus-4-8",
    fallbacks: ["claude-sonnet-5", "gemini-2.5-flash"],
    maxTokens: 2048,
  },
  // Enum picking — small output. If the ~3s target is missed, this is the
  // first candidate to downgrade.
  design_resolution: {
    primary: "claude-opus-4-8",
    fallbacks: ["claude-sonnet-5", "gemini-2.5-flash"],
    maxTokens: 256,
  },
  field_regeneration: {
    primary: "claude-opus-4-8",
    fallbacks: ["claude-sonnet-5", "gemini-2.5-flash"],
    maxTokens: 512,
  },
};
