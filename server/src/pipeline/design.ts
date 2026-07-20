import { completeJson, type ByokKey } from "../llm/gateway.js";
import { DesignTokens, type EventBrief } from "../schemas.js";

const SYSTEM = `You choose design tokens for an event invitation based on its brief. Output only the allowed enum values — rendering is deterministic HTML/CSS on the client.

Guidance:
- palette: wedding/anniversary -> romantic or elegant; kids birthday -> playful; formal or corporate -> minimal or elegant; seasonal or big party -> festive; family gathering/housewarming -> warm.
- typography: serif for elegant/romantic/formal, sans for minimal/modern, script only when the tone is decorative and celebratory.
- layout: classic (centered card) is the safe default; banner for loud celebratory events; split for detail-heavy invitations.
- ornament: match the palette's energy; "none" for minimal.`;

export async function resolveDesign(brief: EventBrief, byok?: ByokKey): Promise<DesignTokens> {
  return completeJson(
    "design_resolution",
    {
      system: SYSTEM,
      user: JSON.stringify(brief),
      schema: DesignTokens,
    },
    byok,
  );
}
