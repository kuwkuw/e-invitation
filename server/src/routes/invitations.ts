import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  GenerateRequest,
  InvitationId,
  PublishRequest,
  RegenerateFieldRequest,
  RsvpRequest,
} from "../schemas.js";
import { generateInvitation } from "../pipeline/generate.js";
import { regenerateField } from "../pipeline/copy.js";
import {
  metricsSnapshot,
  recordFieldRegeneration,
  recordGeneration,
  recordPublish,
  recordRsvp,
} from "../metrics.js";
import { addRsvp, appendVersion, createRecord, getRecord, tokenMatches } from "../store.js";

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

  // Publish a snapshot. Without id/manage_token creates a new invitation;
  // with both, appends a new version to an existing one.
  app.post("/api/invitations/publish", async (request, reply) => {
    let body: PublishRequest;
    try {
      body = PublishRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    if (body.id) {
      const record = getRecord(body.id);
      if (!record) return reply.code(404).send({ error: "Invitation not found." });
      if (!body.manage_token || !tokenMatches(record, body.manage_token)) {
        return reply.code(403).send({ error: "Invalid manage token." });
      }
      const updated = appendVersion(record, body.invitation);
      recordPublish();
      return { id: updated.id, version: updated.versions.length, manage_token: updated.manage_token };
    }
    const record = createRecord(body.invitation);
    recordPublish();
    return { id: record.id, version: 1, manage_token: record.manage_token };
  });

  // Public snapshot for the guest page: latest version only, no token, no RSVPs.
  app.get("/api/invitations/:id", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    return {
      id: record.id,
      version: record.versions.length,
      invitation: record.versions[record.versions.length - 1],
    };
  });

  app.post("/api/invitations/:id/rsvp", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    let body: RsvpRequest;
    try {
      body = RsvpRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    addRsvp(record, { ...body, created_at: new Date().toISOString() });
    recordRsvp();
    return { ok: true };
  });

  // Host-only RSVP list, authenticated by the manage token from publish.
  app.get("/api/invitations/:id/rsvps", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    const token = request.headers["x-manage-token"];
    if (typeof token !== "string" || !tokenMatches(record, token)) {
      return reply.code(403).send({ error: "Invalid manage token." });
    }
    const yes = record.rsvps.filter((r) => r.attending);
    return {
      rsvps: record.rsvps,
      counts: {
        yes: yes.length,
        no: record.rsvps.length - yes.length,
        guests: yes.reduce((sum, r) => sum + r.guests_count, 0),
      },
    };
  });

  app.get("/api/metrics", async () => metricsSnapshot());
}

function lookup(params: unknown) {
  const id = InvitationId.safeParse((params as { id?: string }).id);
  return id.success ? getRecord(id.data) : null;
}

function describeZodError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
  }
  return "Invalid request body.";
}
