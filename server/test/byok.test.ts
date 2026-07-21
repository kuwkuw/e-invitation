import { describe, expect, it } from "vitest";
import { modelsForWalk, providerOf } from "../src/llm/gateway.js";
import { MODEL_PROVIDERS, TASK_ROUTES, type Task } from "../src/llm/routing.js";
import { buildApp } from "../src/app.js";

describe("BYOK model walk (ADR-006)", () => {
  it("maps every routed model to a transport provider", () => {
    const models = Object.values(TASK_ROUTES).flatMap((r) => [r.primary, ...r.fallbacks]);
    for (const model of models) {
      expect(MODEL_PROVIDERS[model], `unmapped model ${model}`).toBeDefined();
      // Groq/Ollama are operator-side transports, never BYOK providers.
      if (MODEL_PROVIDERS[model] === "groq" || MODEL_PROVIDERS[model] === "ollama") {
        expect(providerOf(model)).toBeNull();
      } else {
        expect(providerOf(model)).toBe(MODEL_PROVIDERS[model]);
      }
    }
  });

  it("restricts a BYOK walk to the key's provider (never operator fallback)", () => {
    const tasks = Object.keys(TASK_ROUTES) as Task[];
    for (const task of tasks) {
      for (const provider of ["anthropic", "gemini", "openai"] as const) {
        const walk = modelsForWalk(task, { provider, key: "test" });
        expect(walk.length, `${task}/${provider} has no BYOK models`).toBeGreaterThan(0);
        for (const model of walk) {
          expect(providerOf(model)).toBe(provider);
        }
      }
    }
  });

  it("walks the full route without a BYOK key", () => {
    const route = TASK_ROUTES.copy_generation;
    expect(modelsForWalk("copy_generation")).toEqual([route.primary, ...route.fallbacks]);
  });
});

describe("BYOK headers", () => {
  it("rejects a key without a valid provider", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/invitations/generate",
      headers: { "x-llm-key": "some-key", "x-llm-provider": "grok" },
      payload: { text: "birthday party" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("x-llm-provider");
    await app.close();
  });

  it("rejects a provider without a key", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/invitations/regenerate-field",
      headers: { "x-llm-provider": "gemini" },
      payload: {
        brief: {
          event_type: "birthday",
          hosts: [],
          date: null,
          time: null,
          venue: null,
          city: null,
          tone: "warm",
          language: "uk",
          extra_details: null,
        },
        field: "greeting",
        current_value: "Привіт!",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("x-llm-key");
    await app.close();
  });
});
