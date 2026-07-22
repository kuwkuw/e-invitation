import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { registerOgRoutes } from "./routes/og.js";
import { TASK_ROUTES } from "./llm/routing.js";
import { guardrailsSnapshot } from "./guardrails.js";

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

  // Custom domain: when CANONICAL_HOST is set (e.g. "invito.example.com"),
  // requests reaching the service on any other host — the platform's
  // *.code.run domain, typically — are redirected to the canonical one, so
  // share links published before the switch keep unfurling and resolving on
  // one domain. /healthz is exempt (platform health checks hit the service
  // address directly). 301 for GET/HEAD, 308 to preserve the method
  // otherwise. Unset = no-op.
  app.addHook("onRequest", async (request, reply) => {
    const canonical = process.env.CANONICAL_HOST;
    if (!canonical || request.headers.host === canonical) return;
    if (request.url === "/healthz") return;
    const code = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
    return reply.code(code).redirect(`https://${canonical}${request.url}`);
  });
  // Effective LLM routing, declared once for operators: which provider keys
  // are configured and the model walk per task. There is no capability
  // probing (it would spend quota) — this reports what the server *will
  // try*, not what will succeed.
  const llmInfo = {
    providers: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
    },
    tasks: Object.fromEntries(
      Object.entries(TASK_ROUTES).map(([task, route]) => [task, [route.primary, ...route.fallbacks]]),
    ),
  };
  // guardrails is computed per request (unlike llmInfo): today's spend moves.
  app.get("/healthz", async () => ({ ok: true, llm: llmInfo, guardrails: guardrailsSnapshot() }));
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
