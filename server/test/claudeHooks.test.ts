// The Claude Code hooks in .claude/hooks/ enforce the repo's workflow rules
// (root CLAUDE.md). A hook that silently stops matching is worse than none,
// because everyone believes the rule is enforced, so they are tested here
// like any other code: the pure parts directly, and each hook end to end
// through stdin the way Claude Code runs it.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { twinFor } from "../../.claude/hooks/after-edit.mjs";
import { segments, verdict } from "../../.claude/hooks/guard-main.mjs";
import { changedWorkspaces } from "../../.claude/hooks/typecheck-on-stop.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const HOOKS = join(ROOT, ".claude", "hooks");

function runHook(script: string, payload: unknown, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [join(HOOKS, script)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("guard-main: no commits on main, no pushes to it", () => {
  it.each([
    ["git push origin main", "feature"],
    ["git push origin HEAD:main", "feature"],
    ["git push origin +feature:refs/heads/main", "feature"],
    ["git push --force origin main", "feature"],
    ["git push", "main"],
    ["git push origin HEAD", "main"],
    ["git push --all origin", "feature"],
    ["cd server && git push -u origin main", "feature"],
    ["git -C /repo push origin main", "feature"],
    ["git add -A && git commit -m wip", "main"],
  ])("denies %s (on %s)", (command, branch) => {
    expect(verdict(command, branch)).not.toBeNull();
  });

  it.each([
    ["git push -u origin chore/main-docs", "chore/main-docs"],
    ["git push origin feature", "main"],
    ["git push --force-with-lease", "feature"],
    ["git push", "feature"],
    ["git commit -m 'fix: main menu'", "feature"],
    ["git pull origin main", "feature"],
    ["git log main..HEAD", "main"],
    ["git fetch origin main && git rebase origin/main", "feature"],
  ])("allows %s (on %s)", (command, branch) => {
    expect(verdict(command, branch)).toBeNull();
  });

  it("splits compound commands", () => {
    expect(segments("a && b || c; d | e\nf")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  describe("end to end in a real repository", () => {
    let repo: string;
    beforeAll(() => {
      repo = mkdtempSync(join(tmpdir(), "hook-repo-"));
      const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });
      git("init", "-q", "-b", "main");
    });
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    it("answers a push on main with a deny decision", () => {
      const r = runHook("guard-main.mjs", {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "git push" },
        cwd: repo,
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(out.hookSpecificOutput.permissionDecisionReason).toMatch(/branch/);
    });

    it("stays silent for anything else", () => {
      const r = runHook("guard-main.mjs", {
        tool_name: "Bash",
        tool_input: { command: "pnpm test" },
        cwd: repo,
      });
      expect(r.status).toBe(0);
      expect(r.stdout).toBe("");
    });
  });
});

describe("after-edit: hand-kept twins", () => {
  it("names the twin for every mirrored file, and the eval for prompts", () => {
    expect(twinFor("server/src/schemas.ts")).toMatch(/web\/src\/types\.ts/);
    expect(twinFor("web/src/types.ts")).toMatch(/schemas\.ts/);
    expect(twinFor("server/src/seo.ts")).toMatch(/occasions\.ts/);
    expect(twinFor("web/src/gallery/occasions.ts")).toMatch(/GALLERY_OCCASIONS/);
    expect(twinFor("server/src/pipeline/copy.ts")).toMatch(/eval/);
    expect(twinFor("server/src/llm/routing.ts")).toMatch(/pricing\.ts/);
    expect(twinFor("web/src/App.tsx")).toBeNull();
  });

  it("names every mirror the root CLAUDE.md lists", async () => {
    // The hook's table and the CLAUDE.md list are two copies of one rule.
    const { readFileSync } = await import("node:fs");
    const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
    const listed = claude.slice(
      claude.indexOf("**Hand-kept mirrors.**"),
      claude.indexOf("**One name.**"),
    );
    for (const path of [
      "server/src/schemas.ts",
      "web/src/types.ts",
      "web/src/invitationId.ts",
      "server/src/seo.ts",
      "web/src/gallery/occasions.ts",
      "web/src/prerender.ts",
      "web/src/i18n.ts",
    ]) {
      expect(listed, path).toContain(path);
      expect(twinFor(path), path).not.toBeNull();
    }
  });

  it("reports the twin to Claude once per session (exit 2, stderr)", () => {
    const root = resolve(ROOT);
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: join(root, "server/src/pipeline/brief.ts") },
      cwd: root,
      session_id: `test-${Date.now()}`,
    };
    // brief.ts is lint-clean, so Biome has nothing to report and the
    // reminder is the whole message.
    const env = { CLAUDE_PROJECT_DIR: root };
    const first = runHook("after-edit.mjs", payload, env);
    expect(first.status).toBe(2);
    expect(first.stderr).toMatch(/run pnpm --filter inv-app-server eval/);
    const second = runHook("after-edit.mjs", payload, env);
    expect(second.stderr).not.toMatch(/Hand-kept twin/);
  });

  it("ignores files outside the project", () => {
    const r = runHook("after-edit.mjs", {
      tool_input: { file_path: "/etc/hosts" },
      cwd: "/",
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });
});

describe("typecheck-on-stop", () => {
  it("picks the workspaces whose TypeScript changed", () => {
    const porcelain = [
      " M server/src/app.ts",
      "?? web/src/new.tsx",
      " M docs/README.md",
      "R  server/old.ts -> server/src/renamed.ts",
      " M web/src/styles.css",
    ].join("\n");
    expect(changedWorkspaces(porcelain)).toEqual(["inv-app-server", "inv-app-web"]);
    expect(changedWorkspaces(" M docs/README.md\n M web/src/styles.css")).toEqual([]);
  });

  it("never blocks twice in a row", () => {
    const r = runHook("typecheck-on-stop.mjs", { hook_event_name: "Stop", stop_hook_active: true });
    expect(r.status).toBe(0);
  });
});
