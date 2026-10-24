import { useEffect, useRef, useState } from "react";
import { hasBeenViewed } from "../viewedInvitations";
import type { LoadStatus } from "./usePublishedInvitation";

/** The whole opening, flap to settled card (adr-019 §5.1: ≤ 1.2 s). */
export const ENVELOPE_MS = 1200;

export type EnvelopePhase = "none" | "closed" | "opening";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Whether the guest opens the invitation from an envelope (adr-019 §5.1):
 * first open per browser only, never under reduced motion, and only once the
 * invitation is ready, since the envelope shows its title and monogram.
 *
 * **The decision is read once, at mount, and never again.** `useViewBeacon`
 * writes `inv-viewed:<id>` as soon as the invitation is ready, so anything that
 * re-read `hasBeenViewed` would see the flag flip during the very first open
 * it exists for and drop the envelope mid-animation.
 *
 * Blocked storage answers "not viewed", so the envelope shows every time
 * there. That is the right answer for the counter and a tolerable one here:
 * the envelope is skippable and short.
 *
 * The opening ends on a timer rather than `animationend`, which never fires
 * under reduced-motion durations or in a background tab.
 */
export function useEnvelope(id: string, status: LoadStatus) {
  const [firstOpen] = useState(() => !hasBeenViewed(id) && !prefersReducedMotion());
  const [stage, setStage] = useState<"closed" | "opening" | "gone">("closed");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const phase: EnvelopePhase = firstOpen && status === "ready" && stage !== "gone" ? stage : "none";

  function open() {
    if (timer.current) return;
    setStage("opening");
    timer.current = setTimeout(() => setStage("gone"), ENVELOPE_MS);
  }

  return { phase, open };
}
