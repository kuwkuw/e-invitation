// PostToolUse(Edit|Write|MultiEdit): lint the file just edited, and name its
// hand-kept twin.
//
// 1. Biome `check --write` on the one file: fixes formatting and imports in
//    place, and hands any remaining diagnostic straight back to Claude, while
//    the edit is still in front of it, instead of in CI twenty minutes later.
// 2. Files with no shared source but a twin that must change in the same pass
//    (root CLAUDE.md, "Hand-kept mirrors") get a reminder once per session.
//
// Exit 2 with a message on stderr shows it to Claude (the edit already ran);
// exit 0 is silent.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LINTED = /\.(m?[jt]sx?|cjs|jsonc?|css)$/;

/** Twin reminders, keyed by repo-relative path. Keep in step with the
 *  "Hand-kept mirrors" list in the root CLAUDE.md. */
export const TWINS = {
  "server/src/schemas.ts":
    "schemas.ts is the source of truth; mirror shape changes in web/src/types.ts, and an InvitationId change in isInvitationId (web/src/invitationId.ts).",
  "web/src/types.ts":
    "types.ts mirrors server/src/schemas.ts, which is the source of truth: change the schema there too.",
  "web/src/invitationId.ts": "isInvitationId mirrors InvitationId in server/src/schemas.ts.",
  "server/src/seo.ts":
    "seo.ts has three web twins: SEO_STRINGS ↔ SEO in web/src/i18n.ts, GALLERY_OCCASIONS ↔ web/src/gallery/occasions.ts, prerenderKey ↔ prerenderMarkers in web/src/prerender.ts.",
  "web/src/gallery/occasions.ts":
    "The occasion list is mirrored by GALLERY_OCCASIONS in server/src/seo.ts; a slug on one side only is an indexed dead link.",
  "web/src/prerender.ts":
    "prerenderMarkers mirrors prerenderKey in server/src/seo.ts (`<page>:<lang>`, matched by the server's scanning regex).",
  "web/src/i18n.ts":
    "If you changed SEO, mirror it in SEO_STRINGS (server/src/seo.ts). If you changed LANDING copy on the share cards, regenerate them: node scripts/build-brand-assets.mjs.",
  "server/src/og/render.ts":
    "The OG style maps mirror .palette-*/.type-*/.layout-*/.ornament-* in web/src/styles.css by hand.",
  "web/src/styles.css":
    "If you changed .palette-*/.type-*/.layout-*/.ornament-*, mirror it in server/src/og/render.ts, and diff a rendered OG PNG.",
  "web/src/components/InvitationPreview.tsx":
    "A prop change must reach the DS copy: InvitationPreview.d.ts and .design-sync/conventions.md.",
  "server/src/llm/routing.ts":
    "A routed model needs a pricing.ts entry (test/routing.test.ts). Measure a new model first: pnpm --filter inv-app-server eval -- --model <id>.",
};

const PROMPTS = /^server\/src\/pipeline\/[^/]+\.ts$/;
const PROMPT_REMINDER =
  "This file holds a prompt. Unit tests mock the model and cannot see a prompt regression: run pnpm --filter inv-app-server eval (see server/eval/README.md).";

/** The reminder for a repo-relative path, or null. */
export function twinFor(rel) {
  if (TWINS[rel]) return TWINS[rel];
  if (PROMPTS.test(rel)) return PROMPT_REMINDER;
  return null;
}

/** Remind once per session per file: a reminder on every keystroke-sized
 *  edit stops being read. */
function firstTimeThisSession(sessionId, rel) {
  if (!sessionId) return true;
  const dir = join(tmpdir(), "invinto-claude-hooks");
  const file = join(dir, `${sessionId.replace(/[^\w-]/g, "")}.json`);
  let seen = [];
  try {
    seen = JSON.parse(readFileSync(file, "utf8"));
  } catch {}
  if (seen.includes(rel)) return false;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify([...seen, rel]));
  } catch {}
  return true;
}

function biome(root, file) {
  const bin = join(root, "node_modules", "@biomejs", "biome", "bin", "biome");
  if (!existsSync(bin)) return null; // not installed: nothing to say
  try {
    execFileSync(
      process.execPath,
      [bin, "check", "--write", "--no-errors-on-unmatched", "--colors=off", file],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 },
    );
    return null;
  } catch (error) {
    const out = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    return out.split("\n").slice(0, 40).join("\n");
  }
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const path = input.tool_input?.file_path;
  if (typeof path !== "string") return;
  const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const abs = resolve(input.cwd ?? root, path);
  const rel = relative(root, abs).split(sep).join("/");
  if (rel.startsWith("..") || rel.includes("node_modules/")) return;

  const messages = [];
  if (LINTED.test(rel)) {
    const problems = biome(root, abs);
    if (problems) {
      messages.push(`Biome still reports problems in ${rel} after auto-fix:\n${problems}`);
    }
  }
  const twin = twinFor(rel);
  if (twin && firstTimeThisSession(input.session_id, rel)) messages.push(`Hand-kept twin: ${twin}`);

  if (messages.length) {
    process.stderr.write(`${messages.join("\n\n")}\n`);
    process.exitCode = 2;
  }
}

// Run as a hook; stay inert when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
