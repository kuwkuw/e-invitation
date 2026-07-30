import { useRef, useState } from "react";
import { generateBackground, generateInvitation, regenerateField } from "../api";
import { parseEventStart } from "../calendar";
import { failureMessage } from "../failureMessage";
import type { ChatStrings } from "../i18n";
import type { CopyField, DesignTokens, GenerateSource, Invitation } from "../types";

export type Phase = "empty" | "generating" | "active";

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

/**
 * The editor's core state: the chat transcript that drives generation, the
 * invitation being edited, and the per-field/design edits applied to it.
 *
 * Publishing is deliberately not here — see usePublishing. The split follows
 * the data: everything below depends only on the accumulated description,
 * nothing on a share link.
 */
export function useInvitationEditor(
  chat: ChatStrings,
  source: GenerateSource = "direct",
  /** An invitation parked across the sign-in redirect (adr-014 §2). The editor
   *  comes back mid-session rather than empty, which is the whole reason the
   *  gate can be one sheet instead of two screens. The chat transcript is not
   *  restored — it is a log of how we got here, and the host is looking at the
   *  invitation, not at what they typed. */
  restored: Invitation | null = null,
) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<Phase>(restored ? "active" : "empty");
  // Full event description accumulated across chat turns; each new detail
  // re-runs the whole pipeline on the combined text.
  const [description, setDescription] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(restored);
  const [bgBusy, setBgBusy] = useState(false);
  // Asked at most once per editor session — a date the host doesn't have yet
  // is a legitimate save-the-date, so this nudges and then stays quiet.
  const datePrompted = useRef(false);

  function say(text: string) {
    setMessages((m) => [...m, { role: "assistant", text }]);
  }

  async function send(text: string) {
    if (!text || phase === "generating") return;
    setMessages((m) => [...m, { role: "user", text }]);
    const full = description ? `${description}. ${text}` : text;
    setPhase("generating");
    try {
      const inv = await generateInvitation(full, source);
      setDescription(full);
      setInvitation(inv);
      // Edits invalidate the published snapshot's freshness, not the link.
      say(chat.doneMsg);
      // The copy stage writes around a missing date rather than leaving a
      // placeholder, so the card looks complete and the host is never told.
      // A date too vague to parse costs the guest the same thing as no date
      // at all — GuestActions hides add-to-calendar — so both get the nudge.
      if (!datePrompted.current && !parseEventStart(inv.brief.date, inv.brief.time)) {
        datePrompted.current = true;
        say(chat.dateNudge);
      }
      setPhase("active");
    } catch (error) {
      say(failureMessage(error, chat));
      setPhase(invitation ? "active" : "empty");
    }
  }

  function updateField(field: CopyField, value: string) {
    setInvitation((current) =>
      current ? { ...current, copy: { ...current.copy, [field]: value } } : current,
    );
  }

  function updateDesign(patch: Partial<DesignTokens>) {
    setInvitation((current) =>
      current ? { ...current, design: { ...current.design, ...patch } } : current,
    );
  }

  // AI background layer (adr-009): add and regenerate are the same request —
  // the response replaces the reference. Failures reuse the chat's LLM
  // failure messages (429/503 point at the BYOK escape hatch).
  async function addBackground() {
    if (!invitation || bgBusy) return;
    setBgBusy(true);
    try {
      const background = await generateBackground(invitation.brief, invitation.design);
      setInvitation((current) => (current ? { ...current, background } : current));
    } catch (error) {
      say(failureMessage(error, chat));
    } finally {
      setBgBusy(false);
    }
  }

  function removeBackground() {
    setInvitation((current) => (current ? { ...current, background: null } : current));
  }

  /** One field rewritten by the model, applied in place. Returns false when
   *  the call failed so the caller can keep its sheet open. */
  async function regenerateOneField(field: CopyField): Promise<boolean> {
    if (!invitation) return false;
    try {
      const value = await regenerateField(invitation.brief, field, invitation.copy[field]);
      updateField(field, value);
      return true;
    } catch {
      return false;
    }
  }

  /** Three independent per-field regenerations = three alternatives. Failed
   *  calls are dropped and duplicates collapsed, so this can return fewer
   *  than three — or none, which the sheet renders as an empty list. */
  async function fieldVariants(field: CopyField): Promise<string[]> {
    if (!invitation) return [];
    const current = invitation.copy[field];
    const results = await Promise.allSettled([
      regenerateField(invitation.brief, field, current),
      regenerateField(invitation.brief, field, current),
      regenerateField(invitation.brief, field, current),
    ]);
    const ok = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);
    return [...new Set(ok)];
  }

  return {
    messages,
    phase,
    invitation,
    bgBusy,
    say,
    send,
    updateField,
    updateDesign,
    addBackground,
    removeBackground,
    regenerateOneField,
    fieldVariants,
  };
}
