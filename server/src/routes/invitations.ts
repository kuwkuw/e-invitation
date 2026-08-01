import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { linkInvitation } from "../accounts.js";
import { publishRequiresAccount } from "../auth/google.js";
import { currentUser } from "../auth/session.js";
import { notifyNewReplies } from "../email/replyNotifier.js";
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
  recordInvitationView,
  recordPublish,
  recordRsvp,
} from "../metrics.js";
import { regenerateField } from "../pipeline/copy.js";
import { generateInvitation } from "../pipeline/generate.js";
import { absoluteBase } from "../publicUrl.js";
import { countNewSince, summarizeRsvps } from "../rsvpSummary.js";
import {
  BackgroundId,
  BackgroundRequest,
  ByokProvider,
  CountsRequest,
  type CountsResult,
  GenerateRequest,
  InvitationId,
  PublishRequest,
  RegenerateFieldRequest,
  RsvpRequest,
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
import { claimView } from "../views.js";

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
      recordGeneration(body.source);
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
      // Republish stays purely token-authorized, and must: every share link
      // already in the wild was minted before accounts existed, and adr-014 §1
      // is that auth never revokes a capability. A host holding a valid manage
      // token republishes signed out, forever.
      if (!body.manage_token || !tokenMatches(record, body.manage_token)) {
        return reply.code(403).send({ error: "Invalid manage token." });
      }
      const updated = appendVersion(record, body.invitation);
      recordPublish();
      rememberForHost(request, updated.id);
      return {
        id: updated.id,
        version: updated.versions.length,
        manage_token: updated.manage_token,
      };
    }
    // The adr-014 §2 gate, and the only one in the app: a *first* publish needs
    // an account. Generating, editing, regenerating and the entire guest side
    // stay anonymous — 01-vision intent 1 is that a host types one sentence and
    // gets an invitation without meeting a login. This is the chokepoint
    // 07-monetization §4.2 identifies as where value has been demonstrated.
    //
    // The accepted cost is stated in the ADR: publish-rate will drop, and the
    // drop is not separable after the fact from a copy-quality drop. That is
    // what the baseline frozen at boot exists to make legible.
    const user = currentUser(request);
    if (!user && publishRequiresAccount()) {
      return reply.code(401).send({ error: "Sign in to publish." });
    }
    const record = createRecord(body.invitation);
    recordPublish();
    if (user) linkInvitation(user.id, record.id);
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
    // `addRsvp` is immutable and returns the updated record — the reply that
    // just arrived is only in *that* one. Notifying from `record` would count
    // every reply except the one being notified about, which for a first reply
    // is zero and no email at all.
    const withReply = addRsvp(record, { ...body, created_at: new Date().toISOString() });
    recordRsvp();
    // adr-015 §5: dispatched, never awaited. The RSVP is durable on disk by
    // this line, and the guest must never wait on a mail API or see an error
    // because one failed — the same rule adr-013 §6 applied to the view
    // beacon, with more at stake. `notifyNewReplies` swallows everything, so
    // the floating promise cannot become an unhandled rejection.
    void notifyNewReplies(withReply, absoluteBase(request));
    return { ok: true };
  });

  // Share-loop instrumentation (adr-013 §1). Fired by the guest page once it
  // has loaded the invitation — never by the server while rendering /i/:id,
  // which exists for messenger crawlers (FR-3.5) and would count unfurls
  // instead of guests. Crawlers don't run JS, so they never reach this.
  //
  // No body and no credential: the id is the only thing there is to validate,
  // and an id the server never minted counts nothing. `204` either way — a
  // repeat is not the caller's business, and a guest must never see anything
  // because a metric did or didn't record.
  app.post("/api/invitations/:id/view", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    if (claimView(request.ip, record.id)) recordInvitationView();
    return reply.code(204).send();
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

  // Batch response counts for the returning-host landing list (adr-012,
  // FR-5.7). The app's first multi-credential request: every item carries its
  // own manage token, each authorized only against its own id through the same
  // constant-time compare the single-invitation list uses. A stale or unknown
  // id yields a per-item status and never blanks the other rows, so the batch
  // is a normal 200 even when every item fails — the 400s below are for a
  // malformed or over-cap body only (adr-012 §2, §5). No token spends any LLM
  // capacity, so the adr-008 guardrails stay off it, as they do for /rsvps.
  app.post("/api/invitations/counts", async (request, reply) => {
    let body: CountsRequest;
    try {
      body = CountsRequest.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: describeZodError(error) });
    }
    // Per-host data keyed by secrets — nothing between the browser and the
    // process should retain it (adr-012 §1).
    reply.header("Cache-Control", "no-store");
    return { results: body.items.map(countsForItem) };
  });

  app.get("/api/metrics", async () => metricsSnapshot());
}

/** Add the invitation to the signed-in host's keyring (adr-014 §5), if there
 *  is one. Publishing is not gated yet and may never be for an unconfigured
 *  deployment (§7), so this is strictly additive: a signed-out publish behaves
 *  exactly as it always has, and the manage token in the response is still the
 *  only thing that authorizes anything.
 *
 *  Republish links too. A host who published anonymously, signed in later, and
 *  republished from a browser that still held the token is telling us the
 *  invitation is theirs — and `linkInvitation` is idempotent, so the ordinary
 *  case costs one no-op insert. */
function rememberForHost(request: FastifyRequest, invitationId: string): void {
  const user = currentUser(request);
  if (user) linkInvitation(user.id, invitationId);
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

// One row of the batch-counts response. Positional and per-item: an unknown
// or refused id yields a status only, so a stale token blanks its own row and
// no other (adr-012 §2). Never returns `rsvps` — the landing page gets counts.
function countsForItem(item: CountsRequest["items"][number]): CountsResult {
  const record = getRecord(item.id);
  if (!record) return { id: item.id, status: "not_found" };
  if (!tokenMatches(record, item.token)) return { id: item.id, status: "forbidden" };
  const summary = summarizeRsvps(record.rsvps);
  return {
    id: item.id,
    status: "ok",
    counts: summary.counts,
    new_since: countNewSince(summary.rsvps, item.seen_at),
  };
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
