import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { pruneExpiredSessions } from "./accounts.js";
import { publishRequiresAccount, signInAvailable } from "./auth/google.js";
import { pruneExpiredOauthStates } from "./auth/state.js";
import { notifyWindowMinutes } from "./email/replyNotifier.js";
import { emailConfigured } from "./email/send.js";
import { guardrailsSnapshot } from "./guardrails.js";
import { TASK_ROUTES } from "./llm/routing.js";
import { markBaseline } from "./metrics.js";
import { registerAccountRoutes } from "./routes/account.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { registerOgRoutes } from "./routes/og.js";
import { registerUnsubscribeRoutes } from "./routes/unsubscribe.js";

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
  // Parses and serialises the one cookie the app has (adr-014 §4). No secret
  // is configured because nothing is signed: the session id is 32 random bytes
  // whose only meaning is as a row key, so there is no claim to forge.
  await app.register(cookie);

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
      Object.entries(TASK_ROUTES).map(([task, route]) => [
        task,
        [route.primary, ...route.fallbacks],
      ]),
    ),
  };
  // Host sign-in (adr-014). Unconfigured is a supported mode, not a failure —
  // the server boots, publish stays anonymous, and local development needs no
  // OAuth client, the same way NFR-3 lets it boot without provider keys. This
  // is what /healthz reports and what the client asks before showing any
  // sign-in affordance.
  const authConfigured = signInAvailable();
  const publishGate = publishRequiresAccount();
  if (publishGate) {
    // The instant the gate closes is the instant the "before" period ends —
    // which is why this hangs on the gate rather than on OAuth merely being
    // configured. Freezing here keeps publish-rate and adr-013's
    // new_hosts_per_publish readable across the boundary: both move once
    // publishes are gated, for reasons that have nothing to do with copy
    // quality or the share loop, and 07-monetization §5.1's thresholds were
    // written against an ungated denominator. Idempotent, so restarts never
    // move the baseline.
    markBaseline("auth-gate");
  }
  if (authConfigured) {
    // Abandoned sign-ins and expired sessions accumulate slowly and are dead
    // rows the moment they lapse. Boot is often enough at this size; nothing
    // reads them, so a lingering row is clutter rather than a risk.
    pruneExpiredOauthStates();
    pruneExpiredSessions();
  }

  // guardrails is computed per request (unlike llmInfo): today's spend moves.
  app.get("/healthz", async () => ({
    ok: true,
    llm: llmInfo,
    guardrails: guardrailsSnapshot(),
    auth: { google: authConfigured, publish_gate: publishGate },
    // adr-015 §8: mail-unconfigured is a supported mode, not a failure — the
    // server boots and every other feature is unchanged. Read per request
    // rather than at boot like `auth`, because it is one env lookup and an
    // operator adding the key wants /healthz to agree without a restart.
    notifications: { configured: emailConfigured(), window_minutes: notifyWindowMinutes() },
  }));
  registerAuthRoutes(app);
  registerAccountRoutes(app);
  registerInvitationRoutes(app);
  registerOgRoutes(app);
  // Outside /api (adr-015 §7) and therefore registered before the SPA
  // fallback, which would otherwise serve the shell for this path. Awaited
  // because it registers its routes inside a plugin, which is what keeps its
  // form-body parser off every other endpoint.
  await registerUnsubscribeRoutes(app);

  // Production: serve the built SPA from the same process. /i/:id stays a
  // dynamic route (OG meta injection); everything else non-/api falls back
  // to the SPA shell so /, /create and client-side routes work on reload.
  const webDist = join(process.cwd(), "..", "web", "dist");
  if (existsSync(join(webDist, "index.html"))) {
    await app.register(fastifyStatic, { root: webDist, index: false, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      // HEAD as well as GET: a HEAD is a GET that wants only the headers, and
      // answering it with a JSON 404 makes the site look down to anything that
      // probes that way — uptime checks, link scanners, `curl -I`. Node
      // suppresses the body on a HEAD response by itself, so sending the shell
      // yields the right status and Content-Type with nothing after them.
      // Fastify's `exposeHeadRoutes` already does this for declared GET routes;
      // the not-found handler is the one path it cannot cover, which is exactly
      // the path `/`, `/create` and `/manage/:id` arrive on.
      const wantsShell = request.method === "GET" || request.method === "HEAD";
      if (wantsShell && !request.url.startsWith("/api")) {
        return reply
          .header("Content-Type", "text/html; charset=utf-8")
          .send(readFileSync(join(webDist, "index.html"), "utf8"));
      }
      return reply.code(404).send({ error: "Not found." });
    });
  }

  return app;
}
