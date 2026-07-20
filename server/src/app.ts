import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { registerOgRoutes } from "./routes/og.js";

export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  // trustProxy: behind the hosting proxy (Northflank) request.protocol must
  // come from x-forwarded-proto, or og:image URLs would be built as http.
  // BYOK keys (ADR-006) must never reach logs: fastify's default serializers
  // don't log headers, but redact defensively for any hook that might.
  const app = Fastify({
    logger:
      (options.logger ?? true)
        ? { redact: { paths: ['req.headers["x-llm-key"]'], censor: "[redacted]" } }
        : false,
    trustProxy: true,
  });
  await app.register(cors, { origin: true });
  app.get("/healthz", async () => ({ ok: true }));
  registerInvitationRoutes(app);
  registerOgRoutes(app);

  // Production: serve the built SPA from the same process. /i/:id stays a
  // dynamic route (OG meta injection); everything else non-/api falls back
  // to the SPA shell so /, /create and client-side routes work on reload.
  const webDist = join(process.cwd(), "..", "web", "dist");
  if (existsSync(join(webDist, "index.html"))) {
    await app.register(fastifyStatic, { root: webDist, index: false, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api")) {
        return reply
          .header("Content-Type", "text/html; charset=utf-8")
          .send(readFileSync(join(webDist, "index.html"), "utf8"));
      }
      return reply.code(404).send({ error: "Not found." });
    });
  }

  return app;
}
