import { afterEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { classifyError } from "../src/llm/gateway.js";
import { ProviderHttpError } from "../src/llm/openaiCompat.js";
import { buildApp } from "../src/app.js";

describe("classifyError (ADR-006 failure classes)", () => {
  it("maps Anthropic HTTP errors to auth/quota/other", () => {
    const err = (status: number) =>
      new Anthropic.APIError(status, { error: { message: "x" } }, "x", undefined);
    expect(classifyError(err(401))).toBe("auth");
    expect(classifyError(err(403))).toBe("auth");
    expect(classifyError(err(429))).toBe("quota");
    expect(classifyError(err(500))).toBe("other");
  });

  it("maps OpenAI-compat HTTP errors to auth/quota/other", () => {
    expect(classifyError(new ProviderHttpError(401, "gemini 401"))).toBe("auth");
    expect(classifyError(new ProviderHttpError(403, "gemini 403"))).toBe("auth");
    expect(classifyError(new ProviderHttpError(429, "groq 429"))).toBe("quota");
    expect(classifyError(new ProviderHttpError(500, "openai 500"))).toBe("other");
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
