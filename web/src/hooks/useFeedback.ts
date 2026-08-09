import { useCallback, useState } from "react";
import { ApiError, sendFeedback } from "../api";
import type { FeedbackPage, Language } from "../types";

export type FeedbackStatus = "editing" | "sending" | "sent";
export type FeedbackError = "limited" | "generic";

/**
 * One message from the host to us (adr-016).
 *
 * State lives here rather than in the sheet for the reason every other piece
 * of this app's state does: the components stay composition, and this is what
 * the tests drive. It is deliberately not persisted anywhere — an unsent draft
 * is not worth a `localStorage` key, and every one of those keys is a thing
 * that can throw in private-mode Safari.
 *
 * **Failure keeps the text.** The one unrecoverable outcome for a feedback
 * form is losing what somebody just wrote, so a failed send returns to
 * `editing` with the message intact and an error beside the button, rather
 * than closing or clearing. The daily allowance (§5) is mapped to its own
 * error because "try again in a moment" is false advice for it — the honest
 * answer is tomorrow.
 */
export function useFeedback(page: FeedbackPage, lang: Language) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("editing");
  const [error, setError] = useState<FeedbackError | null>(null);

  // Trimmed here, not only on the server: it is what decides whether the send
  // button is live, and whitespace is not a message.
  const canSend = message.trim().length > 0 && status === "editing";

  const send = useCallback(async () => {
    if (message.trim().length === 0) return;
    setStatus("sending");
    setError(null);
    try {
      await sendFeedback({ message: message.trim(), page, lang });
      setStatus("sent");
    } catch (failure) {
      setStatus("editing");
      setError(failure instanceof ApiError && failure.status === 429 ? "limited" : "generic");
    }
  }, [message, page, lang]);

  return { message, setMessage, status, error, canSend, send };
}
