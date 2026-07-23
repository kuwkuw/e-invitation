import { type FormEvent, useState } from "react";
import { submitRsvp } from "../api";
import type { RsvpInput } from "../types";

/** Server-side bounds from RsvpRequest in schemas.ts; mirrored here so the
 *  stepper can't offer a count the API would reject. */
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 10;

/** Trim and normalize form state into the API's RsvpInput shape. Exported for
 *  tests: this is where "declined" quietly resets the guest count, so an
 *  answer of no never carries a party size the host would see. */
export function buildRsvpInput(fields: {
  name: string;
  attending: boolean;
  guestsCount: number;
  note: string;
}): RsvpInput {
  return {
    name: fields.name.trim(),
    attending: fields.attending,
    guests_count: fields.attending ? fields.guestsCount : 1,
    note: fields.note.trim() ? fields.note.trim() : null,
  };
}

export function useRsvpForm(invitationId: string) {
  const [name, setName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [guestsCount, setGuestsCount] = useState(MIN_GUESTS);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const canSubmit = name.trim().length > 0 && attending !== null && !sending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || attending === null) return;
    setSending(true);
    setSubmitError(false);
    try {
      await submitRsvp(invitationId, buildRsvpInput({ name, attending, guestsCount, note }));
      setSent(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSending(false);
    }
  }

  return {
    name,
    setName,
    attending,
    setAttending,
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
