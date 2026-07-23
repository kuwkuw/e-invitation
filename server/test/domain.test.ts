import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  vi.unstubAllEnvs();
  if (app) {
    await app.close();
    app = null;
  }
});

describe("CANONICAL_HOST redirect", () => {
  it("redirects other hosts to the canonical domain, preserving the path", async () => {
    vi.stubEnv("CANONICAL_HOST", "invito.example.com");
    app = await buildApp({ logger: false });

    const res = await app.inject({
      method: "GET",
      url: "/i/abc123xy?x=1",
      headers: { host: "old-app.code.run" },
    });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe("https://invito.example.com/i/abc123xy?x=1");

    // Non-GET keeps its method via 308.
    const post = await app.inject({
      method: "POST",
      url: "/api/invitations/publish",
      headers: { host: "old-app.code.run" },
      payload: {},
    });
    expect(post.statusCode).toBe(308);
  });

  it("does not redirect the canonical host or /healthz", async () => {
    vi.stubEnv("CANONICAL_HOST", "invito.example.com");
    app = await buildApp({ logger: false });

    const canonical = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { host: "invito.example.com" },
    });
    expect(canonical.statusCode).toBe(200);

    // Platform health checks reach the service on its internal address.
    const health = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { host: "old-app.code.run" },
    });
    expect(health.statusCode).toBe(200);
  });

  it("is a no-op when CANONICAL_HOST is unset", async () => {
    app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { host: "anything.example" },
    });
    expect(res.statusCode).toBe(200);
  });
});
