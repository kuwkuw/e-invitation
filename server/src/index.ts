import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerInvitationRoutes } from "./routes/invitations.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/healthz", async () => ({ ok: true }));
registerInvitationRoutes(app);

const port = Number(process.env.PORT ?? 3001);
try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
