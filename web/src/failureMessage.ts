import { llmFailureKind } from "./api";
import type { ChatStrings } from "./i18n";

// Both LLM-backed editor actions (chat generate, background add) report
// failures the same way: the gateway's failure class, picked out of the 502
// body by llmFailureKind, decides which chat message the host sees. The
// quota/limit wording points at the BYOK escape hatch, so the two paths have
// to stay on one mapping.
export function failureMessage(error: unknown, chat: ChatStrings): string {
  switch (llmFailureKind(error)) {
    case "quota":
      return chat.quotaMsg;
    case "auth":
      return chat.keyMsg;
    case "limited":
      return chat.limitMsg;
    case "busy":
      return chat.busyMsg;
    default:
      return chat.failMsg;
  }
}
