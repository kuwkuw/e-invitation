// Background image generation (adr-009): single-model Gemini call, no
// fallback chain — a failed generation degrades to the CSS-only card. The
// server owns the prompt (built from the structured brief + tokens, never
// free host text) and receives raw bytes; the model never returns URLs or
// markup. Gemini-only: operator GEMINI_API_KEY, or a BYOK gemini key.

import type { DesignTokens, EventBrief } from "../schemas.js";
import type { ByokKey, FailureClass } from "./gateway.js";
import { classifyError } from "./gateway.js";
import { ProviderHttpError } from "./openaiCompat.js";
import { IMAGE_PRICES_PER_IMAGE } from "./pricing.js";
import { recordOperatorSpend } from "../guardrails.js";

export const IMAGE_MODEL = "gemini-2.5-flash-image";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;

// Palette → mood words for the prompt. Mirrors the emotional intent of the
// CSS palettes; minimal is excluded from backgrounds (adr-009) and the route
// rejects it before this map is consulted.
const PALETTE_MOOD: Record<DesignTokens["palette"], string> = {
  warm: "warm cream and terracotta tones, soft golden light",
  elegant: "understated ivory and muted gold, refined and calm",
  playful: "cheerful light yellows and vivid accents, lively",
  minimal: "clean neutral tones",
  festive: "deep night blue with golden sparkle accents, celebratory",
  romantic: "blush pink and soft rose tones, tender",
};

function buildPrompt(brief: EventBrief, design: DesignTokens): string {
  const subject = [brief.event_type, brief.tone].filter(Boolean).join(", ");
  return [
    `A soft, abstract decorative background image for a ${subject} invitation card.`,
    `Mood: ${PALETTE_MOOD[design.palette]}.`,
    "Gentle out-of-focus shapes or delicate textures only; generous even areas so overlaid text stays readable.",
    "Absolutely no text, no letters, no numbers, no words, no typography, no logos, no watermarks of any kind.",
    "No people, no faces.",
  ].join(" ");
}

export class BackgroundGenerationError extends Error {
  constructor(
    message: string,
    public readonly errorClass: FailureClass,
  ) {
    super(message);
    this.name = "BackgroundGenerationError";
  }
}

/** One image, PNG bytes. Spends the BYOK gemini key when given, otherwise
 *  the operator key (recording the flat per-image cost against the daily
 *  budget). Callers must have rejected non-gemini BYOK keys already. */
export async function generateBackgroundImage(
  brief: EventBrief,
  design: DesignTokens,
  byok?: ByokKey,
): Promise<Buffer> {
  const apiKey = byok?.key ?? process.env.GEMINI_API_KEY;
  const startedAt = performance.now();
  const base = {
    ts: new Date().toISOString(),
    task: "background_image",
    model: IMAGE_MODEL,
    ...(byok ? { byok: true } : {}),
  };
  try {
    if (!apiKey) throw new Error(`missing GEMINI_API_KEY (api key for provider "gemini")`);
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(brief, design) }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      throw new ProviderHttpError(response.status, `gemini ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    };
    const inline = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) throw new Error("empty output (no inline image in response)");
    const cost_usd = IMAGE_PRICES_PER_IMAGE[IMAGE_MODEL] ?? null;
    if (!byok) recordOperatorSpend(cost_usd);
    console.log(
      JSON.stringify({
        evt: "llm_request",
        ...base,
        ok: true,
        latency_ms: Math.round(performance.now() - startedAt),
        cost_usd,
      }),
    );
    return Buffer.from(inline.data, "base64");
  } catch (error) {
    const error_class = classifyError(error);
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      JSON.stringify({
        evt: "llm_request",
        ...base,
        ok: false,
        latency_ms: Math.round(performance.now() - startedAt),
        error: message,
        error_class,
      }),
    );
    throw new BackgroundGenerationError(message, error_class);
  }
}
