import type { ByokKey, ByokProvider } from "./types";

// BYOK (ADR-006): the host's provider key lives in localStorage only — the
// same trust model as the manage token. It rides generate/regenerate
// requests as headers (see api.ts) and is never stored server-side.
const BYOK_KEY = "inv-llm-key";

const PROVIDERS: ByokProvider[] = ["gemini", "anthropic", "openai"];

export function loadByok(): ByokKey | null {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ByokKey>;
    if (
      typeof parsed.key === "string" &&
      parsed.key.length > 0 &&
      PROVIDERS.includes(parsed.provider as ByokProvider)
    ) {
      return { provider: parsed.provider as ByokProvider, key: parsed.key };
    }
  } catch {
    // Corrupt entry — treat as absent.
  }
  return null;
}

export function saveByok(byok: ByokKey): void {
  localStorage.setItem(BYOK_KEY, JSON.stringify(byok));
}

export function clearByok(): void {
  localStorage.removeItem(BYOK_KEY);
}
