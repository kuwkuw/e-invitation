import { completeJson, type ByokKey } from "../llm/gateway.js";
import { EventBrief } from "../schemas.js";

const SYSTEM = `You extract a structured event brief from a single free-form sentence describing an event.

Rules:
- Users write in Ukrainian or English. Set "language" to "uk" or "en" to match the input language.
- Never invent facts. Any field not present in the text is null (hosts: empty array).
- Copy date/time/venue/city as the user wrote them — do not normalize or translate them.
- "tone" is a short mood descriptor you infer from the wording (e.g. "warm and familial", "formal", "playful").
- "extra_details" collects anything else the user mentioned: dress code, gifts, theme, who the event is for.`;

export async function extractBrief(text: string, byok?: ByokKey): Promise<EventBrief> {
  return completeJson(
    "brief_extraction",
    {
      system: SYSTEM,
      user: text,
      schema: EventBrief,
    },
    byok,
  );
}
