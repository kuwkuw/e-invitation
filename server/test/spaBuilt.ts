import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Language } from "../src/schemas.js";
import { GALLERY_OCCASIONS, prerenderKey, SEO_MARKER_END, SEO_MARKER_START } from "../src/seo.js";

const SHELL = join(process.cwd(), "..", "web", "dist", "index.html");
const REBUILD = "pnpm --filter inv-app-web build";

/** The SPA fallback only dresses a shell that has been built next to the
 *  server, which is how the production image is laid out but not how a bare
 *  checkout is. Skipping beats a test that fails for the wrong reason. */
export const spaBuilt = existsSync(SHELL);

/** Every prerender key the server can ask a shell for, obtained by asking
 *  `prerenderKey` about the real paths rather than by restating its format.
 *  Restating it would put a third copy of the key shape in the repo, beside
 *  the two that `prerenderKey`'s own comment names. */
function expectedKeys(): string[] {
  const paths = ["/", "/gallery", ...GALLERY_OCCASIONS.map((o) => `/gallery/${o}`)];
  const keys: string[] = [];
  for (const lang of Language.options) {
    for (const path of paths) {
      const key = prerenderKey(path, lang);
      if (key) keys.push(key);
    }
  }
  return keys;
}

/**
 * Fails loudly when `web/dist` exists but was built from different source.
 *
 * The absent case is a skip (`spaBuilt`); this is the other one, and it is not
 * the same thing. A stale shell is a real inconsistency between two workspaces,
 * and `dist/` is gitignored, so it can outlive the branch that produced it and
 * silently become the input to every test below. That is exactly how it fails
 * in practice: a shell built on one branch, read by the tests of another,
 * producing three assertion failures whose diffs are pages of HTML and whose
 * cause appears in none of them.
 *
 * What it checks is the contract `renderShell` depends on: the head block it
 * swaps, and a marked block for every key `prerenderKey` returns. The second
 * half also guards the hand-mirror `prerenderKey` calls out — the server's key
 * format against `web/src/prerender.ts`'s `prerenderMarkers` — which nothing
 * else does. A renamed key on either side lands here.
 */
export function assertShellFresh(): void {
  const html = readFileSync(SHELL, "utf8");
  const problems: string[] = [];

  if (!html.includes(SEO_MARKER_START) || !html.includes(SEO_MARKER_END)) {
    problems.push(`head block ${SEO_MARKER_START}…${SEO_MARKER_END}`);
  }
  for (const key of expectedKeys()) {
    if (!html.includes(`<!--pre:${key}-->`) || !html.includes(`<!--/pre:${key}-->`)) {
      problems.push(`prerendered block <!--pre:${key}-->`);
    }
  }

  if (problems.length > 0) {
    // Listed rather than counted, because one missing key and all of them are
    // different faults: a rename on one side of the mirror, against a shell
    // built somewhere else entirely. Capped so the second does not bury the
    // one line that says what to do about it.
    const shown = problems.slice(0, 4);
    const rest = problems.length - shown.length;
    throw new Error(
      `web/dist/index.html is stale — it does not match this checkout.\n` +
        `Missing:\n${shown.map((p) => `  - ${p}`).join("\n")}\n` +
        (rest > 0 ? `  ...and ${rest} more\n` : "") +
        `Rebuild it:  ${REBUILD}`,
    );
  }
}
