import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { completeCompat, ProviderHttpError } from "../src/llm/openaiCompat.js";

const schema = z.object({ greeting: z.string() });

function okResponse(content = '{"greeting":"hi"}') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    { status: 200 },
  );
}

function stubFetch(response: Response = okResponse()) {
  const spy = vi.fn(async () => response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function requestOf(spy: ReturnType<typeof vi.fn>): { url: string; headers: Record<string, string>; body: Record<string, any> } {
  const [url, init] = spy.mock.calls[0] as [string, RequestInit];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("openaiCompat adapter (adr-007)", () => {
  it("gemini: endpoint, env key, json_schema format, thinking off, schema in prompt", async () => {
    vi.stubEnv("GEMINI_API_KEY", "env-key");
    const spy = stubFetch();
    const result = await completeCompat({
      provider: "gemini",
      model: "gemini-2.5-flash",
      system: "sys",
      user: "usr",
      maxTokens: 256,
      schema,
    });
    const { url, headers, body } = requestOf(spy);
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(headers.authorization).toBe("Bearer env-key");
    expect(body.model).toBe("gemini-2.5-flash");
    expect(body.max_tokens).toBe(256);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.properties.greeting).toBeDefined();
    expect(body.extra_body.google.thinking_config.thinking_budget).toBe(0);
    expect(body.messages[0].content).toContain('"greeting"');
    expect(body.messages[1]).toEqual({ role: "user", content: "usr" });
    expect(result).toEqual({
      text: '{"greeting":"hi"}',
      inputTokens: 10,
      outputTokens: 5,
      stopReason: "stop",
    });
  });

  it("a BYOK key wins over the operator env key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "env-key");
    const spy = stubFetch();
    await completeCompat({
      provider: "gemini",
      model: "gemini-2.5-flash",
      system: "sys",
      user: "usr",
      maxTokens: 256,
      schema,
      apiKey: "byok-key",
    });
    expect(requestOf(spy).headers.authorization).toBe("Bearer byok-key");
  });

  it("groq: endpoint and json_object format (no json_schema support assumed)", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-key");
    const spy = stubFetch();
    await completeCompat({
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      system: "sys",
      user: "usr",
      maxTokens: 1024,
      schema,
    });
    const { url, body } = requestOf(spy);
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("openai: reasoning kept off so small maxTokens caps go to JSON", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-key");
    const spy = stubFetch();
    await completeCompat({
      provider: "openai",
      model: "gpt-5.1",
      system: "sys",
      user: "usr",
      maxTokens: 512,
      schema,
    });
    expect(requestOf(spy).body.reasoning_effort).toBe("none");
  });

  it("ollama: model alias, no key required, no response_format", async () => {
    const spy = stubFetch();
    await completeCompat({
      provider: "ollama",
      model: "gemma3-4b",
      system: "sys",
      user: "usr",
      maxTokens: 1024,
      schema,
    });
    const { url, body } = requestOf(spy);
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(body.model).toBe("gemma3:4b");
    expect(body.response_format).toBeUndefined();
  });

  it("throws before any network call when the operator key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const spy = stubFetch();
    await expect(
      completeCompat({
        provider: "gemini",
        model: "gemini-2.5-flash",
        system: "sys",
        user: "usr",
        maxTokens: 256,
        schema,
      }),
    ).rejects.toThrow(/missing GEMINI_API_KEY/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("wraps non-2xx responses in ProviderHttpError with the status", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-key");
    stubFetch(new Response("rate limit exceeded", { status: 429 }));
    await expect(
      completeCompat({
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        system: "sys",
        user: "usr",
        maxTokens: 1024,
        schema,
      }),
    ).rejects.toMatchObject({ name: "ProviderHttpError", status: 429 });
  });
});
