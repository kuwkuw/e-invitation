import { beforeAll, describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { classifyError } from "../src/llm/gateway.js";
import { buildApp } from "../src/app.js";

describe("classifyError (ADR-006 failure classes)", () => {
  it("maps provider HTTP errors to auth/quota/other", () => {
    const err = (status: number) =>
      new Anthropic.APIError(status, { error: { message: "x" } }, "x", undefined);
    expect(classifyError(err(401))).toBe("auth");
    expect(classifyError(err(403))).toBe("auth");
    expect(classifyError(err(429))).toBe("quota");
    expect(classifyError(err(500))).toBe("other");
  });

  it("maps connection failures to connectivity", () => {
    expect(classifyError(new Anthropic.APIConnectionError({ message: "ECONNREFUSED" }))).toBe(
      "connectivity",
    );
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

  it("maps a missing SDK key to auth, everything else to other", () => {
    expect(
      classifyError(new Error("Could not resolve authentication method. Expected the apiKey...")),
    ).toBe("auth");
    expect(classifyError(new Error("boom"))).toBe("other");
    expect(classifyError("not-an-error")).toBe("other");
  });
});

describe("failure surfaces", () => {
  beforeAll(() => {
    // Force direct mode so the BYOK gemini walk fails deterministically
    // (proxy required) without any network call.
    delete process.env.LLM_BASE_URL;
  });

  it("502 body carries per-model causes (class only, no messages)", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/invitations/generate",
      headers: { "x-llm-provider": "gemini", "x-llm-key": "fake" },
      payload: { text: "birthday party" },
    });
    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.causes).toEqual([{ model: "gemini-2.5-flash", class: expect.any(String) }]);
    expect(JSON.stringify(body)).not.toContain("fake");
    await app.close();
  });

  it("healthz reports the effective routing", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.llm.mode).toBe("direct");
    expect(Object.keys(body.llm.tasks).sort()).toEqual([
      "brief_extraction",
      "copy_generation",
      "design_resolution",
      "field_regeneration",
    ]);
    expect(body.llm.tasks.copy_generation[0]).toBe("claude-opus-4-8");
    await app.close();
  });
});
