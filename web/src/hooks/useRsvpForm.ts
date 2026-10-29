import { type FormEvent, useState } from "react";
import { ApiError, submitRsvp } from "../api";
import type { RsvpAnswer, RsvpInput } from "../types";

/** Server-side bounds from RsvpRequest in schemas.ts; mirrored here so the
 *  stepper can't offer a count the API would reject. */
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 10;

/** Trim and normalize form state into the API's RsvpInput shape. Exported for
 *  tests: this is where a no or a maybe quietly resets the guest count, so
 *  neither carries a party size the host would see (adr-019 §9.1). `attending`
 *  rides beside `answer` for a server that predates the maybe, which reads it
 *  as a no. */
export function buildRsvpInput(fields: {
  name: string;
  answer: RsvpAnswer;
  guestsCount: number;
  note: string;
}): RsvpInput {
  const coming = fields.answer === "yes";
  return {
    name: fields.name.trim(),
    answer: fields.answer,
    attending: coming,
    guests_count: coming ? fields.guestsCount : 1,
    note: fields.note.trim() ? fields.note.trim() : null,
  };
}

export function useRsvpForm(invitationId: string) {
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState<RsvpAnswer | null>(null);
  const [guestsCount, setGuestsCount] = useState(MIN_GUESTS);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // "limited" is the server's per-IP daily allowance (adr-008, amended): a
  // retry can't help until tomorrow, so the form says that instead.
  const [submitError, setSubmitError] = useState<"failed" | "limited" | null>(null);

  const canSubmit = name.trim().length > 0 && answer !== null && !sending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || answer === null) return;
    setSending(true);
    setSubmitError(null);
    try {
      await submitRsvp(invitationId, buildRsvpInput({ name, answer, guestsCount, note }));
      setSent(true);
    } catch (error) {
      setSubmitError(error instanceof ApiError && error.status === 429 ? "limited" : "failed");
    } finally {
      setSending(false);
    }
  }

  return {
    name,
    setName,
    answer,
    setAnswer,
    guestsCount,
    // Clamped here rather than at the call sites so the bounds live in one place.
    increment: () => setGuestsCount((n) => Math.min(MAX_GUESTS, n + 1)),
    decrement: () => setGuestsCount((n) => Math.max(MIN_GUESTS, n - 1)),
    note,
    setNote,
    sending,
    sent,
    /** "Change my answer" reopens the form with the previous values intact. */
    reopen: () => setSent(false),
    submitError,
    canSubmit,
    submit,
  };
}
