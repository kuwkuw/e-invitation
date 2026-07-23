import { beforeEach, describe, expect, it } from "vitest";
import { clearByok, loadByok, saveByok } from "../src/byok";

// BYOK keys (ADR-006) live in localStorage and nowhere else. These tests pin
// the two properties that matter: a malformed entry must never reach the
// request headers, and clearing must actually remove the secret.
describe("byok storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a saved key", () => {
    saveByok({ provider: "gemini", key: "sk-test-123" });
    expect(loadByok()).toEqual({ provider: "gemini", key: "sk-test-123" });
  });

  it("returns null when nothing is stored", () => {
    expect(loadByok()).toBeNull();
  });

  it("rejects entries that would send a bad provider or empty key upstream", () => {
    const bad = [
      JSON.stringify({ provider: "groq", key: "k" }), // operator-only provider
      JSON.stringify({ provider: "gemini", key: "" }),
      JSON.stringify({ provider: "gemini" }),
      JSON.stringify({ key: "k" }),
      "not json at all",
    ];
    for (const raw of bad) {
      localStorage.setItem("inv-llm-key", raw);
      expect(loadByok()).toBeNull();
    }
  });

  it("clears the stored key", () => {
    saveByok({ provider: "anthropic", key: "sk-ant-1" });
    clearByok();
    expect(loadByok()).toBeNull();
    expect(localStorage.getItem("inv-llm-key")).toBeNull();
  });
});
