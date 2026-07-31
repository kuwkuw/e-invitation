import { loadByok } from "./byok";
import type {
  AccountDeletion,
  AuthSession,
  BackgroundRef,
  CopyField,
  CountsRequestItem,
  CountsResponse,
  CountsResult,
  DesignTokens,
  EventBrief,
  GenerateSource,
  Invitation,
  KeyringEntry,
  KeyringResponse,
  NotificationPref,
  PublishedInvitation,
  PublishResult,
  RsvpInput,
  RsvpSummary,
} from "./types";

// 502s from the LLM endpoints carry per-model failure classes (mirrors the
// server's ModelFailure, message stripped) so the UI can say *why*.
export interface LlmCause {
  model: string;
  class: string;
}

export class ApiError extends Error {
  status?: number;
  causes?: LlmCause[];
}

/** Reduce a failed generation to what the host can act on: exhausted quota,
 *  a bad/unauthorized key, the operator guardrails (per-IP daily limit or
 *  global budget, both bypassable with a BYOK key), a transient provider
 *  overload worth retrying, or generic failure. */
export function llmFailureKind(error: unknown): "quota" | "auth" | "limited" | "busy" | "generic" {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status === 503) return "limited";
    if (error.causes && error.causes.length > 0) {
      if (error.causes.some((c) => c.class === "quota")) return "quota";
      if (error.causes.every((c) => c.class === "auth")) return "auth";
      // Every model that answered was down or overloaded (e.g. Gemini 503
      // "high demand") — a retry in a moment is the right advice.
      if (error.causes.every((c) => c.class === "connectivity")) return "busy";
    }
  }
  return "generic";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const error = new ApiError(detail?.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    if (Array.isArray(detail?.causes)) error.causes = detail.causes;
    throw error;
  }
  return response.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// BYOK (ADR-006): if the host saved their own key, the two LLM-backed
// endpoints — and only those — carry it as headers.
function byokHeaders(): Record<string, string> {
  const byok = loadByok();
  return byok ? { "x-llm-provider": byok.provider, "x-llm-key": byok.key } : {};
}

function postLlm<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...byokHeaders() },
    body: JSON.stringify(body),
  });
}

export function generateInvitation(text: string, source: GenerateSource): Promise<Invitation> {
  return postLlm<Invitation>("/api/invitations/generate", { text, source });
}

export async function regenerateField(
  brief: EventBrief,
  field: CopyField,
  currentValue: string,
): Promise<string> {
  const result = await postLlm<{ value: string }>("/api/invitations/regenerate-field", {
    brief,
    field,
    current_value: currentValue,
  });
  return result.value;
}

// Background generation (adr-009) is Gemini-only server-side; a saved
// non-Gemini BYOK key gets a 400 the caller surfaces like other failures.
export async function generateBackground(
  brief: EventBrief,
  design: DesignTokens,
): Promise<BackgroundRef> {
  const result = await postLlm<{ background: BackgroundRef }>("/api/invitations/background", {
    brief,
    design,
  });
  return result.background;
}

export function publishInvitation(
  invitation: Invitation,
  existing?: { id: string; manage_token: string },
): Promise<PublishResult> {
  return post<PublishResult>("/api/invitations/publish", { invitation, ...existing });
}

export function fetchInvitation(id: string): Promise<PublishedInvitation> {
  return request<PublishedInvitation>(`/api/invitations/${id}`);
}

export function submitRsvp(id: string, rsvp: RsvpInput): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>(`/api/invitations/${id}/rsvp`, rsvp);
}

// Share-loop instrumentation (adr-013). Deliberately not routed through
// `request` — the endpoint answers `204` with no body to parse, and there is
// no error worth raising: a guest must never see anything because a metric
// failed. Fire-and-forget, failures swallowed.
export function recordInvitationView(id: string): void {
  fetch(`/api/invitations/${id}/view`, { method: "POST" }).catch(() => {});
}

export function fetchRsvps(id: string, manageToken: string): Promise<RsvpSummary> {
  return request<RsvpSummary>(`/api/invitations/${id}/rsvps`, {
    headers: { "x-manage-token": manageToken },
  });
}

// Batch response counts for the returning-host landing list (adr-012, FR-5.7).
// One request carries every row's manage token; the server answers per item,
// so a stale token blanks only its own row. Results come back positionally,
// one per requested item.
export async function fetchCounts(items: CountsRequestItem[]): Promise<CountsResult[]> {
  const result = await post<CountsResponse>("/api/invitations/counts", { items });
  return result.results;
}

// Host accounts (adr-014). The session rides an httpOnly cookie scoped to
// /api, so these requests need `credentials: "same-origin"` and the client
// never sees the value — what it is signed in *as* comes from the server.
function withSession<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, credentials: "same-origin" });
}

export function fetchAuthSession(): Promise<AuthSession> {
  return withSession<AuthSession>("/api/auth/session");
}

/** Every manage token this account holds — what `localStorage` would have if
 *  this browser had never cleared it (adr-014 §5). */
export async function fetchKeyring(): Promise<KeyringEntry[]> {
  const result = await withSession<KeyringResponse>("/api/account/keyring");
  return result.invitations;
}

export async function signOut(): Promise<void> {
  await withSession<void>("/api/auth/signout", { method: "POST" });
}

/** Reply notifications for one of this account's invitations (adr-015 §7).
 *  Session-authorized: the preference belongs to the account, not to the
 *  invitation, so the manage token cannot name whose to change. */
export function fetchNotificationPref(id: string): Promise<NotificationPref> {
  return withSession<NotificationPref>(`/api/account/notifications/${id}`);
}

export function setNotificationPref(id: string, enabled: boolean): Promise<NotificationPref> {
  return withSession<NotificationPref>(`/api/account/notifications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

/** Deletes the account, never the invitations (adr-014 §9). The count comes
 *  back so the UI can say what was kept rather than leave the host guessing
 *  whether their events went with it. */
export function deleteAccount(): Promise<AccountDeletion> {
  return withSession<AccountDeletion>("/api/account", { method: "DELETE" });
}

/** A full-page navigation, not a fetch: the browser has to follow Google's
 *  redirect chain and come back with a `Set-Cookie`. The one place the app
 *  leaves its own origin, and the one navigation the router cannot own. */
export function startGoogleSignIn(redirectTo: string): void {
  window.location.assign(`/api/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`);
}
