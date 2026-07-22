import { afterEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AllModelsFailedError, classifyError, completeJson } from "../src/llm/gateway.js";
import { ProviderHttpError } from "../src/llm/openaiCompat.js";
import { buildApp } from "../src/app.js";

describe("classifyError (ADR-006 failure classes)", () => {
  it("maps Anthropic HTTP errors to auth/quota/connectivity/other", () => {
    const err = (status: number) =>
      new Anthropic.APIError(status, { error: { message: "x" } }, "x", undefined);
    expect(classifyError(err(401))).toBe("auth");
    expect(classifyError(err(403))).toBe("auth");
    expect(classifyError(err(429))).toBe("quota");
    expect(classifyError(err(500))).toBe("connectivity");
    expect(classifyError(err(529))).toBe("connectivity");
    expect(classifyError(err(400))).toBe("other");
  });

  it("maps OpenAI-compat HTTP errors to auth/quota/connectivity/other", () => {
    expect(classifyError(new ProviderHttpError(401, "gemini 401"))).toBe("auth");
    expect(classifyError(new ProviderHttpError(403, "gemini 403"))).toBe("auth");
    expect(classifyError(new ProviderHttpError(429, "groq 429"))).toBe("quota");
    // Provider down or overloaded (Gemini's 503 UNAVAILABLE "high demand").
    expect(classifyError(new ProviderHttpError(503, "gemini 503: UNAVAILABLE"))).toBe(
      "connectivity",
    );
    expect(classifyError(new ProviderHttpError(500, "openai 500"))).toBe("connectivity");
    expect(classifyError(new ProviderHttpError(400, "openai 400"))).toBe("other");
  });

  it("maps connection failures to connectivity", () => {
    expect(classifyError(new Anthropic.APIConnectionError({ message: "ECONNREFUSED" }))).toBe(
      "connectivity",
    );
    // fetch surfaces network failure as TypeError and timeouts as DOMExceptions.
    expect(classifyError(new TypeError("fetch failed"))).toBe("connectivity");
    expect(classifyError(new DOMException("timed out", "TimeoutError"))).toBe("connectivity");
    expect(classifyError(new DOMException("aborted", "AbortError"))).toBe("connectivity");
  });

  it("maps unusable model output to output-invalid", () => {
    const zodError = z.object({ a: z.string() }).safeParse({}).error;
    expect(classifyError(zodError)).toBe("output-invalid");
    expect(classifyError(new SyntaxError("Unexpected token"))).toBe("output-invalid");
    expect(classifyError(new Error("empty output (stop_reason: max_tokens)"))).toBe(
      "output-invalid",
    );
    expect(classifyError(new Error("no JSON object in output: hi"))).toBe("output-invalid");
  });

  it("maps a missing key to auth, everything else to other", () => {
    expect(
      classifyError(new Error("Could not resolve authentication method. Expected the apiKey...")),
    ).toBe("auth");
    expect(classifyError(new Error('missing GEMINI_API_KEY (api key for provider "gemini")'))).toBe(
      "auth",
    );
    expect(classifyError(new Error("boom"))).toBe("other");
    expect(classifyError("not-an-error")).toBe("other");
  });
});

describe("transient provider errors (5xx)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // BYOK gemini restricts the walk to gemini-2.5-flash, so the fetch stub is
  // the only network boundary and every call is the same model.
  const byok = { provider: "gemini" as const, key: "fake" };
  const spec = {
    system: "sys",
    user: "user",
    schema: z.object({ a: z.string() }),
  };
  const overloaded = () =>
    new Response(
      JSON.stringify({
        error: { code: 503, message: "This model is currently experiencing high demand.", status: "UNAVAILABLE" },
      }),
      { status: 503 },
    );
  const success = () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"a":"hi"}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status: 200 },
    );

  it("retries the same model once after a 503 and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetchMock);
    const result = await completeJson("copy_generation", spec, byok);
    expect(result).toEqual({ a: "hi" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry and reports connectivity", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => overloaded());
    vi.stubGlobal("fetch", fetchMock);
    const failure = await completeJson("copy_generation", spec, byok).catch((e) => e);
    expect(failure).toBeInstanceOf(AllModelsFailedError);
    expect(failure.causes).toEqual([
      {
        model: "gemini-2.5-flash",
        class: "connectivity",
        message: expect.stringContaining("gemini 503"),
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("failure surfaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("502 body carries per-model causes (class only, no messages)", async () => {
    // The BYOK gemini walk is a single real HTTP call now — stub fetch so the
    // test stays offline and fails deterministically with a provider 401.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
            status: 401,
          }),
      ),
    );
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/invitations/generate",
      headers: { "x-llm-provider": "gemini", "x-llm-key": "fake" },
      payload: { text: "birthday party" },
    });
    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.causes).toEqual([{ model: "gemini-2.5-flash", class: "auth" }]);
    expect(JSON.stringify(body)).not.toContain("fake");
    await app.close();
  });

  it("healthz reports the effective routing", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(Object.keys(body.llm.providers).sort()).toEqual(["anthropic", "gemini", "groq", "openai"]);
    for (const configured of Object.values(body.llm.providers)) {
      expect(typeof configured).toBe("boolean");
    }
    expect(Object.keys(body.llm.tasks).sort()).toEqual([
      "brief_extraction",
      "copy_generation",
      "design_resolution",
      "field_regeneration",
    ]);
    expect(body.llm.tasks.brief_extraction[0]).toBe("llama-3.3-70b-versatile");
    expect(body.llm.tasks.copy_generation[0]).toBe("gemini-2.5-flash");
    await app.close();
  });
});
