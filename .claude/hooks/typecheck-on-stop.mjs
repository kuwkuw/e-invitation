// Stop: before Claude reports it is done, typecheck the workspaces whose
// TypeScript changed. A turn that ends with "done" on a tree that doesn't
// compile is the most expensive kind of wrong.
//
// Cheap by construction: it only runs for workspaces with changed .ts/.tsx
// files, and it remembers the last tree that passed, so a turn that changed
// nothing typed costs a `git status`. Exit 2 keeps Claude working, with the
// errors as the reason; it never blocks twice in a row (stop_hook_active),
// so a type error Claude cannot fix doesn't trap the session.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const git = (root, args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/** Workspaces with changed (staged, unstaged or untracked) TypeScript, from
 *  `git status --porcelain` output. */
export function changedWorkspaces(porcelain) {
  const workspaces = new Set();
  for (const line of porcelain.split("\n")) {
    const path = line.slice(3).split(" -> ").at(-1)?.trim() ?? "";
    if (!/\.(ts|tsx|mts)$/.test(path)) continue;
    if (path.startsWith("server/")) workspaces.add("inv-app-server");
    if (path.startsWith("web/")) workspaces.add("inv-app-web");
  }
  return [...workspaces].sort();
}

function treeHash(root) {
  // Tracked changes plus untracked files' contents: anything tsc would read.
  const hash = createHash("sha256")
    .update(root)
    .update(git(root, ["rev-parse", "HEAD"]))
    .update(git(root, ["diff", "HEAD"]));
  for (const file of git(root, ["ls-files", "--others", "--exclude-standard"]).split("\n")) {
    if (/\.(ts|tsx|mts)$/.test(file)) {
      try {
        hash.update(file).update(readFileSync(join(root, file)));
      } catch {}
    }
  }
  return hash.digest("hex");
}

/** Failure summaries per workspace, `[]` when all pass, or null when pnpm
 *  can't be run here. */
function typecheck(root, workspaces) {
  const failures = [];
  for (const workspace of workspaces) {
    try {
      execFileSync("pnpm", ["--filter", workspace, "typecheck"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 170_000,
        shell: process.platform === "win32",
      });
    } catch (error) {
      if (error.code === "ENOENT") return null;
      const out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      const lines = out.split("\n").filter((l) => /error TS|: error/.test(l));
      failures.push(
        `${workspace}:\n${(lines.length ? lines : out.split("\n")).slice(0, 30).join("\n")}`,
      );
    }
  }

  return failures;
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.stop_hook_active) return;
  const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  if (!existsSync(join(root, "node_modules"))) return;

  let workspaces;
  let hash;
  try {
    workspaces = changedWorkspaces(git(root, ["status", "--porcelain"]));
    if (workspaces.length === 0) return;
    hash = treeHash(root);
  } catch {
    return; // not a git checkout: nothing to compare against
  }

  const stamp = join(tmpdir(), "invinto-claude-hooks", "typecheck-passed");
  // One stamp per machine is enough: the hash already covers the checkout's
  // path, its commit and every change on top of it.
  try {
    if (readFileSync(stamp, "utf8") === hash) return;
  } catch {}

  const failures = typecheck(root, workspaces);
  if (failures === null) return; // no pnpm on PATH: don't guess
  if (failures.length === 0) {
    try {
      mkdirSync(join(tmpdir(), "invinto-claude-hooks"), { recursive: true });
      writeFileSync(stamp, hash);
    } catch {}
    return;
  }
  process.stderr.write(
    `Typecheck fails in the code you changed. Fix it before finishing (or say plainly that it is left broken):\n\n${failures.join("\n\n")}\n`,
  );
  process.exitCode = 2;
}

// Run as a hook; stay inert when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
