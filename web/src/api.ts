import type {
  CopyField,
  EventBrief,
  Invitation,
  PublishResult,
  PublishedInvitation,
  RsvpInput,
  RsvpSummary,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `Request failed (${response.status})`);
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

export function generateInvitation(text: string): Promise<Invitation> {
  return post<Invitation>("/api/invitations/generate", { text });
}

export async function regenerateField(
  brief: EventBrief,
  field: CopyField,
  currentValue: string,
): Promise<string> {
  const result = await post<{ value: string }>("/api/invitations/regenerate-field", {
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
