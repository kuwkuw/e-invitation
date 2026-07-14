import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { GenerateRequest, RegenerateFieldRequest } from "../schemas.js";
import { generateInvitation } from "../pipeline/generate.js";
import { regenerateField } from "../pipeline/copy.js";
import { metricsSnapshot, recordFieldRegeneration, recordGeneration } from "../metrics.js";

export function registerInvitationRoutes(app: FastifyInstance): void {
  app.post("/api/invitations/generate", async (request, reply) => {
    let body: GenerateRequest;
    try {
      body = GenerateRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    try {
      const invitation = await generateInvitation(body.text);
      recordGeneration();
      return invitation;
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Generation failed on all routed models." });
    }
  });

  app.post("/api/invitations/regenerate-field", async (request, reply) => {
    let body: RegenerateFieldRequest;
    try {
      body = RegenerateFieldRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    try {
      const value = await regenerateField(body.brief, body.field, body.current_value);
      recordFieldRegeneration(body.field);
      return { value };
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Regeneration failed on all routed models." });
    }
  });

  app.get("/api/metrics", async () => metricsSnapshot());
}

function describeZodError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
  }
  return "Invalid request body.";
}
