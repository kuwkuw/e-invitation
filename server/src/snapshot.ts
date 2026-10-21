// A consistent copy of the accounts database, refreshed on a timer, so a
// volume backup always carries one SQLite file that opens cleanly.
//
// Everything else under DATA_DIR is already safe to snapshot at any instant:
// invitation records, metrics.json and background PNGs are each written
// whole and renamed into place. app.db is not — it runs in WAL mode, so the
// live database is two files that change together, and a platform snapshot
// is only promised to be point-in-time, "may not capture in-flight writes"
// (Northflank). `VACUUM INTO` produces a single, transactionally consistent
// file from the open connection without blocking readers.
//
// One rolling file, not a history: history is the volume backups' job (see
// docs/05-deployment.md, Backups). What this file guarantees is that every one
// of those backups holds a copy at most one interval old that needs no WAL
// replay and no luck.

import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.js";
import { dataDir } from "./store.js";

const DEFAULT_INTERVAL_MINUTES = 60;

export type SnapshotResult =
  | { status: "written"; path: string; at: string }
  | { status: "skipped"; reason: "no-database" }
  | { status: "failed"; reason: string };

let lastWrittenAt: string | null = null;

/** Minutes between snapshots; 0 disables, like the guardrails' env vars.
 *  A malformed value falls back to the default rather than disabling, so a
 *  typo cannot quietly turn backups off. */
export function snapshotIntervalMinutes(): number {
  const raw = process.env.DB_SNAPSHOT_MINUTES;
  if (raw === undefined || raw.trim() === "") return DEFAULT_INTERVAL_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_INTERVAL_MINUTES;
  return parsed;
}

export function snapshotPath(): string {
  return join(dataDir(), "snapshots", "app.db");
}

/** When the last snapshot was written by this process, or null. Reported on
 *  /healthz so an uptime check can alert on a snapshot that stopped. */
export function lastSnapshotAt(): string | null {
  return lastWrittenAt;
}

/** Write a consistent copy of app.db to DATA_DIR/snapshots/app.db.
 *
 *  Never throws: a failed snapshot must not take the server down, and the
 *  previous good copy is left in place. Skips when no database exists — a
 *  deployment without sign-in never creates one, and this must not either. */
export function snapshotDb(): SnapshotResult {
  if (!existsSync(join(dataDir(), "app.db"))) return { status: "skipped", reason: "no-database" };
  const target = snapshotPath();
  const tmp = `${target}.tmp`;
  try {
    const db = getDb();
    // A damaged database must not overwrite the last good copy: the copy is
    // the thing a restore reaches for when the live file is the problem.
    const check = db.prepare("PRAGMA quick_check").get() as { quick_check: string } | undefined;
    if (check?.quick_check !== "ok") {
      return { status: "failed", reason: `quick_check: ${check?.quick_check ?? "no result"}` };
    }
    mkdirSync(join(dataDir(), "snapshots"), { recursive: true });
    // VACUUM INTO refuses an existing target; a leftover .tmp is from a run
    // that died mid-write and is worthless.
    rmSync(tmp, { force: true });
    db.prepare("VACUUM INTO ?").run(tmp);
    renameSync(tmp, target);
    lastWrittenAt = new Date().toISOString();
    return { status: "written", path: target, at: lastWrittenAt };
  } catch (error) {
    rmSync(tmp, { force: true });
    return { status: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

interface SnapshotLogger {
  info(object: object, message: string): void;
  error(object: object, message: string): void;
}

/** Start the timer. Called from index.ts, not buildApp(), so tests that build
 *  the app never start one. Not run at boot on purpose: a process restarting
 *  over a database it just damaged would otherwise replace the good copy
 *  before anyone looked. Returns a stop function. */
export function startDbSnapshots(log: SnapshotLogger): () => void {
  const minutes = snapshotIntervalMinutes();
  if (minutes === 0) return () => {};
  const timer = setInterval(() => {
    const result = snapshotDb();
    if (result.status === "failed") log.error({ snapshot: result }, "db snapshot failed");
    else if (result.status === "written") log.info({ snapshot: result }, "db snapshot written");
  }, minutes * 60_000);
  // Never the reason the process stays alive.
  timer.unref();
  return () => clearInterval(timer);
}

/** Tests only: forget the last-written time between cases. */
export function resetSnapshotState(): void {
  lastWrittenAt = null;
}
