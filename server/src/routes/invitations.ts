import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { budgetExhausted, consumeIpAllowance, type LimitedTask } from "../guardrails.js";
import { AllModelsFailedError, type ByokKey } from "../llm/gateway.js";
import {
  BackgroundGenerationError,
  generateBackgroundImage,
  IMAGE_MODEL,
} from "../llm/imageGen.js";
import {
  metricsSnapshot,
  recordBackground,
  recordFieldRegeneration,
  recordGeneration,
  recordPublish,
  recordRsvp,
} from "../metrics.js";
import { regenerateField } from "../pipeline/copy.js";
import { generateInvitation } from "../pipeline/generate.js";
import {
  BackgroundId,
  BackgroundRequest,
  ByokProvider,
  GenerateRequest,
  InvitationId,
  PublishRequest,
  RegenerateFieldRequest,
  type Rsvp,
  RsvpRequest,
  type RsvpSummary,
} from "../schemas.js";
import {
  addRsvp,
  appendVersion,
  createRecord,
  getRecord,
  readBackground,
  saveBackground,
  tokenMatches,
} from "../store.js";

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
    const limited = guardOperatorRequest(request, "generation", byok);
    if (limited) return reply.code(limited.status).send({ error: limited.error });
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
    const limited = guardOperatorRequest(request, "regeneration", byok);
    if (limited) return reply.code(limited.status).send({ error: limited.error });
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

  // Optional AI background layer (adr-009). Gemini-only, single model, no
  // fallback: failure degrades to the CSS-only card. The response is an
  // opaque stored-asset id — image bytes are served by GET /api/backgrounds.
  app.post("/api/invitations/background", async (request, reply) => {
    let body: BackgroundRequest;
    try {
      body = BackgroundRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    if (body.design.palette === "minimal") {
      return reply.code(400).send({ error: "The minimal palette does not support backgrounds." });
    }
    let byok: ByokKey | undefined;
    try {
      byok = byokFromHeaders(request);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    if (byok && byok.provider !== "gemini") {
      return reply.code(400).send({
        error: "Background generation supports Gemini keys only; remove or switch the AI key.",
      });
    }
    const limited = guardOperatorRequest(request, "background", byok);
    if (limited) return reply.code(limited.status).send({ error: limited.error });
    try {
      const bytes = await generateBackgroundImage(body.brief, body.design, byok);
      const id = saveBackground(bytes);
      recordBackground();
      return { background: { id } };
    } catch (error) {
      request.log.error(error);
      const cls = error instanceof BackgroundGenerationError ? error.errorClass : "other";
      return reply.code(502).send({
        error: "Background generation failed.",
        causes: [{ model: IMAGE_MODEL, class: cls }],
      });
    }
  });

  // Public background bytes. Ids are unguessable and the asset is as public
  // as the invitation that references it; immutable ids allow long caching.
  app.get("/api/backgrounds/:id", async (request, reply) => {
    const id = BackgroundId.safeParse((request.params as { id?: string }).id);
    const bytes = id.success ? readBackground(id.data) : null;
    if (!bytes) return reply.code(404).send({ error: "Background not found." });
    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(bytes);
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
      return {
        id: updated.id,
        version: updated.versions.length,
        manage_token: updated.manage_token,
      };
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
    return summarizeRsvps(record.rsvps);
  });

  app.get("/api/metrics", async () => metricsSnapshot());
}

// Host-facing RSVP summary (adr-010 §5). Storage stays append-only — a guest
// who changes their mind just submits again (FR-4.4) — so the collapsing
// happens here, at read time. Within a group of answers sharing a normalized
// name the latest one is live and the earlier ones are flagged `superseded`;
// counts cover the live answers only, because `guests` is the headcount the
// host caters on and a changed mind must not inflate it.
function summarizeRsvps(rsvps: Rsvp[]): RsvpSummary {
  const liveByName = new Map<string, { index: number; created_at: string }>();
  rsvps.forEach((rsvp, index) => {
    const key = groupKey(rsvp.name);
    const live = liveByName.get(key);
    // Scanning forward with >= makes the later arrival win ties, so answers
    // sharing a timestamp resolve by submission order.
    if (live === undefined || rsvp.created_at >= live.created_at) {
      liveByName.set(key, { index, created_at: rsvp.created_at });
    }
  });

  const liveIndexes = new Set([...liveByName.values()].map((live) => live.index));
  const entries = rsvps.map((rsvp, index) => ({
    ...rsvp,
    superseded: !liveIndexes.has(index),
  }));
  const attending = entries.filter((e) => !e.superseded && e.attending);

  return {
    rsvps: entries,
    counts: {
      yes: attending.length,
      no: entries.filter((e) => !e.superseded && !e.attending).length,
      guests: attending.reduce((sum, e) => sum + e.guests_count, 0),
    },
  };
}

// Grouping key for re-submissions. Deliberately conservative: only an exact
// name match (ignoring case and stray whitespace) collapses, and both rows
// stay in the list, so two real guests sharing a name is visible to the host
// rather than silently merged.
function groupKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Operator-cost guardrails (ADR-008), checked after validation and before
// any LLM work. BYOK requests spend the caller's key and are exempt. Budget
// first (global condition → 503), then the per-IP allowance (→ 429); the
// web client maps both statuses to messages pointing at the BYOK escape
// hatch, so wording here stays generic.
function guardOperatorRequest(
  request: FastifyRequest,
  task: LimitedTask,
  byok: ByokKey | undefined,
): { status: 429 | 503; error: string } | null {
  if (byok) return null;
  if (budgetExhausted()) {
    return {
      status: 503,
      error:
        "The free AI capacity for today is used up. Try again tomorrow or use your own AI key.",
    };
  }
  if (!consumeIpAllowance(request.ip, task)) {
    return {
      status: 429,
      error: "Daily limit reached. Try again tomorrow or use your own AI key.",
    };
  }
  return null;
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
