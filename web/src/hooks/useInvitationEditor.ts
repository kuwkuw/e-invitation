import { useCallback, useEffect, useRef, useState } from "react";
import { generateBackground, generateInvitation, regenerateField } from "../api";
import { isPastDate, isPastEventStart, parseEventStart } from "../calendar";
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
  /** An invitation the editor starts with, that no generate in this session
   *  produced. Two callers, one state:
   *
   *  - a draft parked across the sign-in redirect (adr-014 §2), which is why
   *    the gate can be one sheet instead of two screens;
   *  - a gallery sample the visitor pressed "use this one" on (adr-017 §4).
   *
   *  The chat transcript is not restored either way — it is a log of how we
   *  got here, and the host is looking at the invitation, not at what they
   *  typed. */
  restored: Invitation | null = null,
  /** The sentence a gallery sample was generated from (adr-017 §4).
   *
   *  Without it `description` starts empty, and the host's first chat turn
   *  would generate from "12 жовтня, ресторан Софія" alone — no wedding, no
   *  hosts, no tone — replacing the invitation they chose with an unrelated
   *  one. Empty for every other entry point, including the sign-in draft,
   *  whose transcript is deliberately not restored. */
  seededDescription = "",
) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<Phase>(restored ? "active" : "empty");
  // Full event description accumulated across chat turns; each new detail
  // re-runs the whole pipeline on the combined text.
  const [description, setDescription] = useState(seededDescription);
  const [invitation, setInvitation] = useState<Invitation | null>(restored);
  const [bgBusy, setBgBusy] = useState(false);
  // Asked at most once per editor session — a date the host doesn't have yet
  // is a legitimate save-the-date, so this nudges and then stays quiet.
  const datePrompted = useRef(false);

  // Stable identity: `say` is returned to `App.tsx` and is a dependency of
  // `noteDateState` below, which the seed effect depends on in turn.
  const say = useCallback((text: string) => {
    setMessages((m) => [...m, { role: "assistant", text }]);
  }, []);

  /** What the chat says about an invitation's date, wherever it came from.
   *
   *  The copy stage writes around a missing date rather than leaving a
   *  placeholder, so the card looks complete and the host is never told. A date
   *  too vague to parse costs the guest what no date costs them — GuestActions
   *  hides add-to-calendar — so both get the nudge, once per session (FR-1.7).
   *
   *  A date already gone by is the same silence with the opposite cause: it
   *  renders, it exports to a calendar, and nothing about the finished card
   *  says the year is last year's. That one blocks publishing (FR-1.8), so it
   *  is said on **every** turn it is still true rather than once — the reason a
   *  button is disabled cannot be scrolled past.
   *
   *  Lifted out of `send` for adr-017 §4: a gallery sample never goes through a
   *  generate, and a sample always has a null date, so leaving this inside the
   *  generate handler meant nobody was ever asked when the event was. */
  const noteDateState = useCallback(
    (inv: Invitation) => {
      const start = parseEventStart(inv.brief.date, inv.brief.time);
      if (!start) {
        if (!datePrompted.current) {
          datePrompted.current = true;
          say(chat.dateNudge);
        }
      } else if (isPastEventStart(start)) {
        say(chat.pastDateBlock);
      }
    },
    [chat, say],
  );

  // Ref-guarded rather than state-guarded: StrictMode runs effects twice on the
  // same instance, and a state guard would let the second pass through before
  // the first had committed — the same reason adr-014 §2's sign-in resume is
  // ref-guarded. `restored` is the mount-time invitation and never changes
  // identity for the life of this hook, so the empty dependency list is the
  // honest description of when this runs.
  const seedAnnounced = useRef(false);
  useEffect(() => {
    if (!restored || seedAnnounced.current) return;
    seedAnnounced.current = true;
    noteDateState(restored);
  }, [restored, noteDateState]);

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
      noteDateState(inv);
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

  // Derived rather than remembered: it has to be right for an invitation
  // restored from the sign-in draft too, which no generate ran for in this
  // session. `usePublishing` re-tests the same rule on the press — this flag
  // is what makes the refusal visible before the host reaches for it.
  const dateBlocked = invitation ? isPastDate(invitation.brief.date, invitation.brief.time) : false;

  return {
    messages,
    phase,
    invitation,
    bgBusy,
    /** FR-1.8: the event's day has gone by, so publishing is refused until the
     *  host moves it. */
    dateBlocked,
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
