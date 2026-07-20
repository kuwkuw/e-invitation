import type { Invitation } from "../schemas.js";
import type { ByokKey } from "../llm/gateway.js";
import { extractBrief } from "./brief.js";
import { generateCopy } from "./copy.js";
import { resolveDesign } from "./design.js";

/**
 * The core pipeline: sentence -> brief -> parallel [copy | design] -> invitation.
 * Copy and design both depend only on the brief, so they always run concurrently.
 * A BYOK key (ADR-006) applies to every call in the request.
 */
export async function generateInvitation(text: string, byok?: ByokKey): Promise<Invitation> {
  const brief = await extractBrief(text, byok);
  const [copy, design] = await Promise.all([
    generateCopy(brief, byok),
    resolveDesign(brief, byok),
  ]);
  return { brief, copy, design };
}
