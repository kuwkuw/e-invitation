import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  ByokProvider,
  GenerateRequest,
  InvitationId,
  PublishRequest,
  RegenerateFieldRequest,
  RsvpRequest,
} from "../schemas.js";
import { AllModelsFailedError, type ByokKey } from "../llm/gateway.js";
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
    let byok: ByokKey | undefined;
    try {
      byok = byokFromHeaders(request);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    try {
      const invitation = await generateInvitation(body.text, byok);
      recordGeneration();
      return invitation;
    } catch (error) {
      request.log.error(error);
      return reply
        .code(502)
        .send({ error: "Generation failed on all routed models.", causes: llmCauses(error) });
    }
  });

  app.post("/api/invitations/regenerate-field", async (request, reply) => {
    let body: RegenerateFieldRequest;
    try {
      body = RegenerateFieldRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    let byok: ByokKey | undefined;
    try {
      byok = byokFromHeaders(request);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    try {
      const value = await regenerateField(body.brief, body.field, body.current_value, byok);
      recordFieldRegeneration(body.field);
      return { value };
    } catch (error) {
      request.log.error(error);
      return reply
        .code(502)
        .send({ error: "Regeneration failed on all routed models.", causes: llmCauses(error) });
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

// Per-model failure classes for the 502 body: which models were tried and
// why each failed (auth/quota/connectivity/...). Raw provider messages stay
// in the llm_request log lines — the API surface gets only the class.
function llmCauses(error: unknown): { model: string; class: string }[] | undefined {
  if (!(error instanceof AllModelsFailedError)) return undefined;
  return error.causes.map(({ model, class: cls }) => ({ model, class: cls }));
}

// BYOK headers (ADR-006). The key is transient request context: parsed
// here, passed down, never persisted or logged. Absent headers mean the
// operator-key routing applies unchanged.
function byokFromHeaders(request: FastifyRequest): ByokKey | undefined {
  const key = request.headers["x-llm-key"];
  const provider = request.headers["x-llm-provider"];
  if (key === undefined && provider === undefined) return undefined;
  if (typeof key !== "string" || key.length === 0 || key.length > 256) {
    throw new Error("x-llm-key must be a non-empty API key (with x-llm-provider).");
  }
  const parsed = ByokProvider.safeParse(provider);
  if (!parsed.success) {
    throw new Error(`x-llm-provider must be one of: ${ByokProvider.options.join(", ")}.`);
  }
  return { provider: parsed.data, key };
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
