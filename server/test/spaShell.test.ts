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

  // FR-4.6: a share link that resolves to nothing (deleted, truncated in a
  // chat, mistyped) renders the guest page's dead-link state. Answering it with
  // a JSON body showed a guest `{"error":…}` on a direct load; the shell lets
  // the app say so in words. Still a 404, so a crawler or a link checker reads
  // it as gone, and noindex like every /i/ page.
  it.each([
    ["GET", "/i/Ab3dE5gH7j"],
    ["GET", "/i/x"],
    ["HEAD", "/i/Ab3dE5gH7j"],
  ] as const)(
    "answers a dead share link on %s %s with the shell, as a 404",
    async (method, url) => {
      app = await buildApp({ logger: false });
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(404);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
      if (method === "HEAD") return;
      expect(res.body).toContain('<meta name="robots" content="noindex, nofollow">');
      expect(res.body).not.toContain('rel="canonical"');
      // Not the marketing page under a guest's link: every prerendered block is
      // stripped, and the head names no page an unfurler would show as ours.
      expect(res.body).toMatch(/<div id="root"><\/div>/);
      expect(res.body).toContain("Сторінку не знайдено");
    },
  );

  // The fallback is for client-side routes only; an unknown API path is a real
  // 404 and must not be handed an HTML page to parse as JSON.
  it.each(["GET", "HEAD"] as const)("still 404s an unknown /api path on %s", async (method) => {
    app = await buildApp({ logger: false });
    const res = await app.inject({ method, url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});
