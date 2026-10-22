import { z } from "zod";
import { type ByokKey, completeJson } from "../llm/gateway.js";
import { type CopyField, type EventBrief, InvitationCopy } from "../schemas.js";

const COPY_SYSTEM = `You write the text of an event invitation from a structured event brief.

Rules:
- Write in the brief's language: "uk" means Ukrainian, "en" means English. Every field in that language.
- Match the brief's tone.
- Every date, time, number, name and place in any field must come from the brief. Do not add one the brief does not contain.
- rsvp_prompt asks the guest to confirm attendance and nothing more: no reply-by date or deadline, no phone number, no contact person. The host never gave one, and a guest who reads an invented deadline believes it.
- Never use placeholder text: no [DATE], [Name], [Імена організаторів], TBD or any bracketed slot. If a detail is missing from the brief, write around it naturally (e.g. no date -> "деталі згодом" / "details to follow" only if it reads well, otherwise omit).
- If hosts is empty, sign the closing without names (e.g. "До зустрічі!" / "See you there!").
- details_line contains only facts from the brief (date, time, venue, city) formatted for reading — no invented specifics.
- Keep it short and warm: this is a card, not a letter.`;

export async function generateCopy(brief: EventBrief, byok?: ByokKey): Promise<InvitationCopy> {
  return completeJson(
    "copy_generation",
    {
      system: COPY_SYSTEM,
      user: JSON.stringify(brief),
      schema: InvitationCopy,
    },
    byok,
  );
}

const REGEN_SYSTEM = `You rewrite exactly one field of an event invitation.

Rules:
- Same language as the brief ("uk" = Ukrainian, "en" = English), same tone, same facts.
- Produce a genuinely different wording from the current value — not a light paraphrase.
- Only facts from the brief: no date, deadline, time, number, name or place it does not contain (an rsvp_prompt gets no reply-by date).
- Never use placeholder text such as [Name] or any bracketed slot; with no hosts, sign off without names.`;

const FieldValue = z.object({
  value: z.string().describe("The rewritten field text"),
});

export async function regenerateField(
  brief: EventBrief,
  field: CopyField,
  currentValue: string,
  byok?: ByokKey,
): Promise<string> {
  const result = await completeJson(
    "field_regeneration",
    {
      system: REGEN_SYSTEM,
      user: JSON.stringify({ brief, field, current_value: currentValue }),
      schema: FieldValue,
    },
    byok,
  );
  return result.value;
}
