import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetGuardrails } from "../src/guardrails.js";
import type { DesignTokens, EventBrief } from "../src/schemas.js";

const brief: EventBrief = {
  event_type: "birthday",
  hosts: ["Олена"],
  date: "12 серпня",
  time: "18:00",
  venue: "Кафе «Затишок»",
  city: "Львів",
  tone: "warm and familial",
  language: "uk",
  extra_details: null,
};

const design: DesignTokens = {
  palette: "warm",
  typography: "serif",
  layout: "classic",
  ornament: "floral",
};

// 1×1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function stubGeminiImage(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG_BASE64 } }] } },
            ],
          }),
          { status: 200 },
        ),
    ),
  );
}

let app: FastifyInstance;
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-bg-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.GEMINI_API_KEY = "test-key";
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ logger: false });
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetGuardrails();
});

describe("background generation (adr-009)", () => {
  it("generates, stores, and serves a background image", async () => {
    stubGeminiImage();
    const res = await app.inject({
      method: "POST",
      url: "/api/invitations/background",
      payload: { brief, design },
    });
    expect(res.statusCode).toBe(200);
    const { background } = res.json();
    expect(background.id).toMatch(/^[A-Za-z0-9_-]{6,32}$/);

    const img = await app.inject({ method: "GET", url: `/api/backgrounds/${background.id}` });
    expect(img.statusCode).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
    expect(img.headers["cache-control"]).toContain("immutable");
    expect(img.rawPayload.equals(Buffer.from(PNG_BASE64, "base64"))).toBe(true);

    // The image prompt is server-built and forbids text in the image.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const requestBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(requestBody.contents[0].parts[0].text).toMatch(/no text/i);
  });

  it("rejects the minimal palette and non-gemini BYOK keys", async () => {
    stubGeminiImage();
    const minimal = await app.inject({
      method: "POST",
      url: "/api/invitations/background",
      payload: { brief, design: { ...design, palette: "minimal" } },
    });
    expect(minimal.statusCode).toBe(400);

    const wrongKey = await app.inject({
      method: "POST",
      url: "/api/invitations/background",
      headers: { "x-llm-provider": "openai", "x-llm-key": "sk-x" },
      payload: { brief, design },
    });
    expect(wrongKey.statusCode).toBe(400);
    expect(wrongKey.json().error).toMatch(/Gemini/);
  });

  it("applies the per-IP background allowance; BYOK gemini bypasses it", async () => {
    vi.stubEnv("LIMIT_BACKGROUNDS_PER_DAY", "1");
    stubGeminiImage();
    const hit = (headers?: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: "/api/invitations/background",
        headers: { "x-forwarded-for": "203.0.113.9", ...headers },
        payload: { brief, design },
      });

    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(429);
    expect((await hit({ "x-llm-provider": "gemini", "x-llm-key": "user-key" })).statusCode).toBe(
      200,
    );
  });

  it("maps a provider failure to 502 with a cause class", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }),
      ),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/invitations/background",
      payload: { brief, design },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().causes).toEqual([{ model: "gemini-2.5-flash-image", class: "quota" }]);
  });

  it("404s unknown or malformed background ids", async () => {
    for (const url of ["/api/backgrounds/unknown12345", "/api/backgrounds/..%2Fmetrics"]) {
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
    }
  });

  it("publish accepts an invitation carrying a background reference", async () => {
    stubGeminiImage();
    const bg = (
      await app.inject({
        method: "POST",
        url: "/api/invitations/background",
        payload: { brief, design },
      })
    ).json().background;

    const invitation = {
      brief,
      design,
      background: bg,
      copy: {
        title: "Запрошення",
        greeting: "Любі друзі!",
        body: "Запрошуємо вас.",
        details_line: "12 серпня, 18:00",
        rsvp_prompt: "Підтвердіть присутність.",
        closing: "Олена",
      },
    };
    const published = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      payload: { invitation },
    });
    expect(published.statusCode).toBe(200);
    const { id } = published.json();
    const publicView = await app.inject({ method: "GET", url: `/api/invitations/${id}` });
    expect(publicView.json().invitation.background).toEqual(bg);
  });
});
