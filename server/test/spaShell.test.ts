import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { assertShellFresh, spaBuilt } from "./spaBuilt.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
});

describe.skipIf(!spaBuilt)("SPA shell fallback", () => {
  beforeAll(assertShellFresh);

  it.each(["/", "/create", "/manage/abc123xy"])("serves the shell for GET %s", async (url) => {
    app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });

  // A HEAD is a GET that wants only the headers. Answering it with a JSON 404
  // makes the site look down to anything that probes that way — uptime checks,
  // link scanners, `curl -I`.
  it.each(["/", "/create"])("answers HEAD %s the same way", async (url) => {
    app = await buildApp({ logger: false });
    const res = await app.inject({ method: "HEAD", url });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });

  // The fallback is for client-side routes only; an unknown API path is a real
  // 404 and must not be handed an HTML page to parse as JSON.
  it.each(["GET", "HEAD"] as const)("still 404s an unknown /api path on %s", async (method) => {
    app = await buildApp({ logger: false });
    const res = await app.inject({ method, url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});
