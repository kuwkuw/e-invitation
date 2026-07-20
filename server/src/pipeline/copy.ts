import { z } from "zod";
import { completeJson, type ByokKey } from "../llm/gateway.js";
import { InvitationCopy, type CopyField, type EventBrief } from "../schemas.js";

const COPY_SYSTEM = `You write the text of an event invitation from a structured event brief.

Rules:
- Write in the brief's language: "uk" means Ukrainian, "en" means English. Every field in that language.
- Match the brief's tone.
- Never use placeholder text like [DATE] or TBD. If a detail is missing from the brief, write around it naturally (e.g. no date -> "деталі згодом" / "details to follow" only if it reads well, otherwise omit).
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
- Never use placeholder text; only facts from the brief.`;

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
