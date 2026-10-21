import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkInvitation, listKeyring, upsertUser } from "../src/accounts.js";
import { closeDb, getDb } from "../src/db.js";
import {
  lastSnapshotAt,
  resetSnapshotState,
  snapshotDb,
  snapshotIntervalMinutes,
  snapshotPath,
  startDbSnapshots,
} from "../src/snapshot.js";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-snapshot-test-"));
  process.env.DATA_DIR = dataDir;
  resetSnapshotState();
});

afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("db snapshot", () => {
  it("writes a copy that opens on its own and holds the live data", () => {
    const user = upsertUser("google-sub-1", "host@example.com");
    linkInvitation(user.id, "inv-1");

    const result = snapshotDb();

    expect(result.status).toBe("written");
    expect(lastSnapshotAt()).not.toBeNull();
    // Opened as a separate file with no WAL beside it: that is exactly the
    // state a restore from a volume backup starts in.
    const copy = new DatabaseSync(snapshotPath(), { readOnly: true });
    try {
      expect(readdirSync(join(dataDir, "snapshots"))).toEqual(["app.db"]);
      const rows = copy.prepare("SELECT invitation_id FROM keyring").all();
      expect(rows).toEqual([{ invitation_id: "inv-1" }]);
      expect(
        (copy.prepare("PRAGMA integrity_check").get() as { integrity_check: string })
          .integrity_check,
      ).toBe("ok");
    } finally {
      copy.close();
    }
  });

  it("replaces the previous copy rather than accumulating them", () => {
    const user = upsertUser("google-sub-1", "host@example.com");
    snapshotDb();
    linkInvitation(user.id, "inv-2");
    snapshotDb();

    const copy = new DatabaseSync(snapshotPath(), { readOnly: true });
    try {
      expect(copy.prepare("SELECT count(*) AS n FROM keyring").get()).toEqual({ n: 1 });
    } finally {
      copy.close();
    }
    expect(listKeyring(user.id)).toHaveLength(1);
  });

  // A deployment without sign-in never creates app.db, and taking a snapshot
  // must not be what creates it.
  it("skips, and creates nothing, when there is no database", () => {
    expect(snapshotDb()).toEqual({ status: "skipped", reason: "no-database" });
    expect(existsSync(join(dataDir, "app.db"))).toBe(false);
    expect(existsSync(join(dataDir, "snapshots"))).toBe(false);
  });

  it("clears a leftover temp file from a run that died mid-write", () => {
    getDb();
    snapshotDb();
    writeFileSync(`${snapshotPath()}.tmp`, "half a database");

    expect(snapshotDb().status).toBe("written");
    expect(existsSync(`${snapshotPath()}.tmp`)).toBe(false);
  });
});

describe("snapshot interval", () => {
  it("defaults to hourly", () => {
    vi.stubEnv("DB_SNAPSHOT_MINUTES", undefined as unknown as string);
    expect(snapshotIntervalMinutes()).toBe(60);
  });

  it("is disabled by 0, like the guardrails", () => {
    vi.stubEnv("DB_SNAPSHOT_MINUTES", "0");
    expect(snapshotIntervalMinutes()).toBe(0);
  });

  // A typo must not quietly turn backups off.
  it("falls back to the default on a malformed value", () => {
    vi.stubEnv("DB_SNAPSHOT_MINUTES", "hourly");
    expect(snapshotIntervalMinutes()).toBe(60);
    vi.stubEnv("DB_SNAPSHOT_MINUTES", "-5");
    expect(snapshotIntervalMinutes()).toBe(60);
  });

  it("does not snapshot at start, only once an interval has passed", () => {
    vi.useFakeTimers();
    vi.stubEnv("DB_SNAPSHOT_MINUTES", "15");
    getDb();
    const log = { info: vi.fn(), error: vi.fn() };

    const stop = startDbSnapshots(log);
    expect(existsSync(snapshotPath())).toBe(false);

    vi.advanceTimersByTime(15 * 60_000);
    expect(existsSync(snapshotPath())).toBe(true);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
    stop();
  });
});
