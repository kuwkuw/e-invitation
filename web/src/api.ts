import type {
  CopyField,
  EventBrief,
  Invitation,
  PublishResult,
  PublishedInvitation,
  RsvpInput,
  RsvpSummary,
} from "./types";
import { loadByok } from "./byok";

// 502s from the LLM endpoints carry per-model failure classes (mirrors the
// server's ModelFailure, message stripped) so the UI can say *why*.
export interface LlmCause {
  model: string;
  class: string;
}

export class ApiError extends Error {
  causes?: LlmCause[];
}

/** Reduce a failed generation to what the host can act on: exhausted quota,
 *  a bad/unauthorized key, or generic failure. */
export function llmFailureKind(error: unknown): "quota" | "auth" | "generic" {
  if (error instanceof ApiError && error.causes && error.causes.length > 0) {
    if (error.causes.some((c) => c.class === "quota")) return "quota";
    if (error.causes.every((c) => c.class === "auth")) return "auth";
  }
  return "generic";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const error = new ApiError(detail?.error ?? `Request failed (${response.status})`);
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

export function generateInvitation(text: string): Promise<Invitation> {
  return postLlm<Invitation>("/api/invitations/generate", { text });
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

export function fetchRsvps(id: string, manageToken: string): Promise<RsvpSummary> {
  return request<RsvpSummary>(`/api/invitations/${id}/rsvps`, {
    headers: { "x-manage-token": manageToken },
  });
}
