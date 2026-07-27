import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test re-imports the module fresh so counters reload from disk —
// exactly what a server restart does.
async function freshMetrics() {
  vi.resetModules();
  return import("../src/metrics.js");
}

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-metrics-test-"));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("durable metrics", () => {
  it("persists counters and reloads them on restart", async () => {
    const m1 = await freshMetrics();
    m1.recordGeneration();
    m1.recordGeneration();
    m1.recordFieldRegeneration("title");
    m1.recordPublish();
    m1.recordRsvp();
    m1.recordInvitationView();

    const stored = JSON.parse(readFileSync(join(dataDir, "metrics.json"), "utf8"));
    expect(stored.generations).toBe(2);

    const m2 = await freshMetrics();
    expect(m2.metricsSnapshot()).toEqual({
      generations: 2,
      field_regenerations: { title: 1 },
      regenerate_rate: 0.5,
      backgrounds: 0,
      publishes: 1,
      publish_rate: 0.5,
      rsvps: 1,
      invitation_views: 1,
    });
  });

  // The counters this iteration adds have to arrive on top of a file that has
  // been accumulating in production since long before them — the whole value
  // of the share-loop numbers is a ratio measured over months (adr-013).
  it("upgrades a metrics file written before invitation_views existed", async () => {
    writeFileSync(
      join(dataDir, "metrics.json"),
      JSON.stringify({
        generations: 9,
        field_regenerations: {},
        backgrounds: 0,
        publishes: 4,
        rsvps: 5,
      }),
      "utf8",
    );
    const upgraded = await freshMetrics();
    const snapshot = upgraded.metricsSnapshot();
    expect(snapshot.generations).toBe(9);
    expect(snapshot.publishes).toBe(4);
    expect(snapshot.rsvps).toBe(5);
    expect(snapshot.invitation_views).toBe(0);

    upgraded.recordInvitationView();
    expect(upgraded.metricsSnapshot().invitation_views).toBe(1);
    // The pre-existing counters survive the first write of the new shape.
    expect(JSON.parse(readFileSync(join(dataDir, "metrics.json"), "utf8")).generations).toBe(9);
  });

  it("derives publish_rate, with 0 for zero generations", async () => {
    const m = await freshMetrics();
    expect(m.metricsSnapshot().publish_rate).toBe(0);
    m.recordGeneration();
    m.recordPublish();
    m.recordPublish();
    expect(m.metricsSnapshot().publish_rate).toBe(2);
  });

  it("starts fresh on a corrupt or partial metrics file", async () => {
    writeFileSync(join(dataDir, "metrics.json"), "{not json", "utf8");
    const corrupt = await freshMetrics();
    expect(corrupt.metricsSnapshot().generations).toBe(0);

    writeFileSync(
      join(dataDir, "metrics.json"),
      JSON.stringify({ generations: 7, field_regenerations: { body: "NaN" } }),
      "utf8",
    );
    const partial = await freshMetrics();
    const snapshot = partial.metricsSnapshot();
    expect(snapshot.generations).toBe(7);
    expect(snapshot.field_regenerations).toEqual({});
    expect(snapshot.rsvps).toBe(0);
  });
});
