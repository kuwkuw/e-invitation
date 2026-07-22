// File-backed store for published invitations: one JSON file per id under
// DATA_DIR (default ./data relative to the server process). Good enough for
// the current single-process setup; swap for a real DB behind these same
// functions when multi-instance hosting arrives.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Invitation, Rsvp } from "./schemas.js";

export interface PublishedRecord {
  id: string;
  manage_token: string;
  versions: Invitation[];
  rsvps: Rsvp[];
  created_at: string;
  updated_at: string;
}

// Read lazily so tests can point DATA_DIR at a scratch dir before first use.
// Also used by metrics.ts — one data directory for everything persisted.
export function dataDir(): string {
  return process.env.DATA_DIR ?? join(process.cwd(), "data");
}

function recordPath(id: string): string {
  return join(dataDir(), `${id}.json`);
}

function save(record: PublishedRecord): void {
  mkdirSync(dataDir(), { recursive: true });
  // Write-then-rename so a crash mid-write never leaves a truncated record.
  const path = recordPath(record.id);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(record, null, 2), "utf8");
  renameSync(tmp, path);
}

export function getRecord(id: string): PublishedRecord | null {
  const path = recordPath(id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as PublishedRecord;
}

export function createRecord(invitation: Invitation): PublishedRecord {
  const now = new Date().toISOString();
  const record: PublishedRecord = {
    id: randomBytes(8).toString("base64url"),
    manage_token: randomBytes(16).toString("hex"),
    versions: [invitation],
    rsvps: [],
    created_at: now,
    updated_at: now,
  };
  save(record);
  return record;
}

export function appendVersion(record: PublishedRecord, invitation: Invitation): PublishedRecord {
  const updated: PublishedRecord = {
    ...record,
    versions: [...record.versions, invitation],
    updated_at: new Date().toISOString(),
  };
  save(updated);
  return updated;
}

export function addRsvp(record: PublishedRecord, rsvp: Rsvp): PublishedRecord {
  const updated: PublishedRecord = {
    ...record,
    rsvps: [...record.rsvps, rsvp],
    updated_at: new Date().toISOString(),
  };
  save(updated);
  return updated;
}

export function tokenMatches(record: PublishedRecord, token: string): boolean {
  const expected = Buffer.from(record.manage_token);
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
