// PreToolUse(Bash): refuse to commit on `main` or push to it.
//
// Northflank deploys every push to `main` and runs no checks, so a commit
// that lands there skips CI on its way to production. Work goes on a branch
// and reaches `main` through a PR (root CLAUDE.md, Workflow).
//
// Reads the hook payload on stdin; denies with a reason, or exits 0 silently.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = "main";

/** The branch checked out in `cwd`, or null outside a repo or on a detached
 *  HEAD. `symbolic-ref` rather than `rev-parse --abbrev-ref`: the latter
 *  fails on a branch with no commits yet, which would wave its push through. */
function currentBranch(cwd) {
  try {
    return execFileSync("git", ["symbolic-ref", "--short", "-q", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** Split a shell command into simple commands at `&&`, `||`, `;`, `|` and
 *  newlines. Good enough for the commands an agent writes; quoting is not
 *  parsed, so a message that merely mentions "git push" can be caught too —
 *  the safe direction for a guard. */
export function segments(command) {
  return command
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Words of one simple command, with a leading `cd …`/env assignments and
 *  `git -C <dir>` / `-c k=v` options removed, so `git -C x push` reads as
 *  `git push`. */
function gitArgs(segment) {
  const words = segment.split(/\s+/);
  while (words.length && /^\w+=/.test(words[0])) words.shift();
  if (words[0] !== "git") return null;
  const args = words.slice(1);
  while (args.length && (args[0] === "-C" || args[0] === "-c")) args.splice(0, 2);
  return args;
}

const targetsMain = (refspec) => {
  const dst = refspec.replace(/^\+/, "").split(":").at(-1);
  return dst === MAIN || dst === `refs/heads/${MAIN}`;
};

/** Why this command must not run, or null. */
export function verdict(command, branch) {
  for (const segment of segments(command)) {
    const args = gitArgs(segment);
    if (!args) continue;
    const [sub, ...rest] = args;
    if (sub === "commit" && branch === MAIN) {
      return `You are on \`${MAIN}\`. Create a branch first (git switch -c <name>) and commit there; changes reach \`${MAIN}\` only through a PR.`;
    }
    if (sub !== "push") continue;
    if (rest.some((a) => a === "--all" || a === "--mirror")) {
      return `\`git push ${rest.join(" ")}\` would push \`${MAIN}\` too. Push the branch by name.`;
    }
    const positional = rest.filter((a) => !a.startsWith("-"));
    const refspecs = positional.slice(1); // first positional is the remote
    if (refspecs.some(targetsMain)) {
      return `Pushing to \`${MAIN}\` deploys to production with no checks. Push a branch and open a PR.`;
    }
    const onlyHead = refspecs.length === 0 || refspecs.every((r) => r === "HEAD");
    if (onlyHead && branch === MAIN) {
      return `You are on \`${MAIN}\`, so this push would update \`${MAIN}\` and deploy with no checks. Create a branch first.`;
    }
  }
  return null;
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const command = input.tool_input?.command;
  if (typeof command !== "string" || !/\bgit\b/.test(command)) return;
  const reason = verdict(command, currentBranch(input.cwd ?? process.cwd()));
  if (!reason) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}

// Run as a hook; stay inert when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
