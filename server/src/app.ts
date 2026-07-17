import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { registerOgRoutes } from "./routes/og.js";

export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  await app.register(cors, { origin: true });
  app.get("/healthz", async () => ({ ok: true }));
  registerInvitationRoutes(app);
  registerOgRoutes(app);
  return app;
}
