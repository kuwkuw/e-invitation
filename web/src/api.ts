import type { CopyField, EventBrief, Invitation } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
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
