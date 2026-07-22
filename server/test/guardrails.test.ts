import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  budgetExhausted,
  consumeIpAllowance,
  recordOperatorSpend,
  resetGuardrails,
} from "../src/guardrails.js";
import { buildApp } from "../src/app.js";

// Keep the walk offline: every provider call fails fast with a 401, so an
// admitted request ends as a 502 and a guarded one as 429/503.
function stubFetchAuthFailure(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 401 }),
    ),
  );
}

let app: FastifyInstance | null = null;

beforeEach(() => {
  resetGuardrails();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (app) {
    await app.close();
    app = null;
  }
});

describe("per-IP daily allowance", () => {
  it("admits up to the limit per IP and task, then rejects", () => {
    vi.stubEnv("LIMIT_GENERATIONS_PER_DAY", "2");
    expect(consumeIpAllowance("198.51.100.1", "generation")).toBe(true);
    expect(consumeIpAllowance("198.51.100.1", "generation")).toBe(true);
    expect(consumeIpAllowance("198.51.100.1", "generation")).toBe(false);
    // Another IP and the other task keep their own allowances.
    expect(consumeIpAllowance("198.51.100.2", "generation")).toBe(true);
    expect(consumeIpAllowance("198.51.100.1", "regeneration")).toBe(true);
  });

  it("0 disables the limit", () => {
    vi.stubEnv("LIMIT_GENERATIONS_PER_DAY", "0");
    for (let i = 0; i < 50; i++) {
      expect(consumeIpAllowance("198.51.100.1", "generation")).toBe(true);
    }
  });

  it("generate returns 429 over the limit; another IP is unaffected", async () => {
    vi.stubEnv("LIMIT_GENERATIONS_PER_DAY", "1");
    stubFetchAuthFailure();
    app = await buildApp({ logger: false });

    const hit = (ip: string) =>
      app!.inject({
        method: "POST",
        url: "/api/invitations/generate",
        headers: { "x-forwarded-for": ip },
        payload: { text: "birthday party" },
      });

    expect((await hit("203.0.113.5")).statusCode).toBe(502); // admitted, walk failed
    const limited = await hit("203.0.113.5");
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toMatch(/own AI key/);
    expect((await hit("203.0.113.6")).statusCode).toBe(502);
  });

  it("BYOK requests bypass the limit", async () => {
    vi.stubEnv("LIMIT_GENERATIONS_PER_DAY", "1");
    stubFetchAuthFailure();
    app = await buildApp({ logger: false });

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/invitations/generate",
        headers: { "x-forwarded-for": "203.0.113.7", "x-llm-provider": "gemini", "x-llm-key": "k" },
        payload: { text: "birthday party" },
      });
      expect(res.statusCode).toBe(502); // never 429 — the key's walk just fails
    }
  });
});

describe("daily budget circuit breaker", () => {
  it("trips once operator spend reaches the budget", () => {
    vi.stubEnv("DAILY_BUDGET_USD", "0.01");
    expect(budgetExhausted()).toBe(false);
    recordOperatorSpend(0.004);
    recordOperatorSpend(null); // unknown cost never counts
    expect(budgetExhausted()).toBe(false);
    recordOperatorSpend(0.006);
    expect(budgetExhausted()).toBe(true);
  });

  it("generate returns 503 when exhausted; BYOK still admitted", async () => {
    vi.stubEnv("DAILY_BUDGET_USD", "0.01");
    recordOperatorSpend(0.02);
    stubFetchAuthFailure();
    app = await buildApp({ logger: false });

    const blocked = await app.inject({
      method: "POST",
      url: "/api/invitations/generate",
      payload: { text: "birthday party" },
    });
    expect(blocked.statusCode).toBe(503);

    const byok = await app.inject({
      method: "POST",
      url: "/api/invitations/generate",
      headers: { "x-llm-provider": "gemini", "x-llm-key": "k" },
      payload: { text: "birthday party" },
    });
    expect(byok.statusCode).toBe(502);
  });

  it("healthz exposes limits and today's spend", async () => {
    vi.stubEnv("DAILY_BUDGET_USD", "2");
    recordOperatorSpend(0.5);
    app = await buildApp({ logger: false });

    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json().guardrails).toEqual({
      limits: {
        generations_per_ip_per_day: 10,
        regenerations_per_ip_per_day: 30,
        backgrounds_per_ip_per_day: 3,
      },
      budget: { daily_usd: 2, spent_today_usd: 0.5, exhausted: false },
    });
  });
});
