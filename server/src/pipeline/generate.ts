import type { Invitation } from "../schemas.js";
import { extractBrief } from "./brief.js";
import { generateCopy } from "./copy.js";
import { resolveDesign } from "./design.js";

/**
 * The core pipeline: sentence -> brief -> parallel [copy | design] -> invitation.
 * Copy and design both depend only on the brief, so they always run concurrently.
 */
export async function generateInvitation(text: string): Promise<Invitation> {
  const brief = await extractBrief(text);
  const [copy, design] = await Promise.all([generateCopy(brief), resolveDesign(brief)]);
  return { brief, copy, design };
}
