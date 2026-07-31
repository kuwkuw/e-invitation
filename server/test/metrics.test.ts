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
      referred_generations: 0,
      views_per_publish: 1,
      new_hosts_per_publish: 0,
      baseline: null,
    });
  });

  // The number 07-monetization §5.1 gates every commercial option on.
  it("counts a referred generation in both totals and derives the rates", async () => {
    const m = await freshMetrics();
    m.recordGeneration("guest");
    m.recordGeneration("direct");
    // Absent source = direct, so a client that predates adr-013 keeps working.
    m.recordGeneration();
    m.recordInvitationView();
    m.recordInvitationView();
    m.recordInvitationView();
    m.recordPublish();
    m.recordPublish();

    const snapshot = m.metricsSnapshot();
    // A referred generation is a generation like any other, and additionally
    // the share loop having worked once.
    expect(snapshot.generations).toBe(3);
    expect(snapshot.referred_generations).toBe(1);
    expect(snapshot.views_per_publish).toBe(1.5);
    expect(snapshot.new_hosts_per_publish).toBe(0.5);
  });

  it("derives the share-loop rates as 0 before anything is published", async () => {
    const m = await freshMetrics();
    m.recordGeneration("guest");
    m.recordInvitationView();
    expect(m.metricsSnapshot().views_per_publish).toBe(0);
    expect(m.metricsSnapshot().new_hosts_per_publish).toBe(0);
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
    expect(snapshot.referred_generations).toBe(0);

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

  // adr-014 §2: the publish gate moves publish_rate and new_hosts_per_publish
  // for reasons unrelated to what either measures. Without a frozen "before",
  // the two periods blend into one number and neither is readable.
  describe("gate baseline", () => {
    it("splits the counters into before and since at the moment it is taken", async () => {
      const m = await freshMetrics();
      // Pre-gate: production's lifetime numbers as adr-013 recorded them.
      for (let i = 0; i < 9; i++) m.recordGeneration();
      for (let i = 0; i < 4; i++) m.recordPublish();

      m.markBaseline("auth-gate");

      // Post-gate: the same traffic, half of it now failing to reach publish.
      for (let i = 0; i < 4; i++) m.recordGeneration();
      m.recordPublish();

      const snapshot = m.metricsSnapshot();
      expect(snapshot.generations).toBe(13);
      expect(snapshot.publishes).toBe(5);

      const baseline = snapshot.baseline;
      expect(baseline?.reason).toBe("auth-gate");
      expect(baseline?.before.generations).toBe(9);
      expect(baseline?.before.publishes).toBe(4);
      expect(baseline?.since.generations).toBe(4);
      expect(baseline?.since.publishes).toBe(1);
      // The comparison the ADR's revisit trigger is written against.
      expect(baseline?.before.publish_rate).toBeCloseTo(0.444, 3);
      expect(baseline?.since.publish_rate).toBe(0.25);
    });

    it("is idempotent across restarts, so booting never re-freezes it", async () => {
      const m1 = await freshMetrics();
      m1.recordGeneration();
      m1.recordPublish();
      const first = m1.markBaseline("auth-gate");

      m1.recordGeneration();
      m1.recordGeneration();

      // The gate calls this at boot, so every restart would otherwise reset
      // "before" to the current numbers and erase the comparison.
      const m2 = await freshMetrics();
      const second = m2.markBaseline("auth-gate");
      expect(second.at).toBe(first.at);

      const baseline = m2.metricsSnapshot().baseline;
      expect(baseline?.before.generations).toBe(1);
      expect(baseline?.since.generations).toBe(2);
    });

    it("derives before/since rates through the same code as lifetime", async () => {
      const m = await freshMetrics();
      m.markBaseline("auth-gate");
      m.recordGeneration("guest");
      m.recordGeneration("guest");
      m.recordInvitationView();
      m.recordPublish();

      const snapshot = m.metricsSnapshot();
      // Nothing happened before the baseline, so "since" must equal lifetime.
      expect(snapshot.baseline?.since.new_hosts_per_publish).toBe(snapshot.new_hosts_per_publish);
      expect(snapshot.baseline?.since.views_per_publish).toBe(snapshot.views_per_publish);
      // ...and an empty "before" derives zeros rather than dividing by zero.
      expect(snapshot.baseline?.before.new_hosts_per_publish).toBe(0);
      expect(snapshot.baseline?.before.publish_rate).toBe(0);
    });

    it("clamps a baseline that is ahead of the counters instead of going negative", async () => {
      // What a metrics.json restored from a backup older than its own baseline
      // looks like. Negative activity reads as a broken deploy; zero reads as
      // what it is.
      writeFileSync(
        join(dataDir, "metrics.json"),
        JSON.stringify({
          generations: 2,
          field_regenerations: {},
          publishes: 1,
          baseline: {
            at: "2026-07-30T00:00:00.000Z",
            reason: "auth-gate",
            counters: { generations: 9, publishes: 4 },
          },
        }),
        "utf8",
      );
      const m = await freshMetrics();
      const baseline = m.metricsSnapshot().baseline;
      expect(baseline?.since.generations).toBe(0);
      expect(baseline?.since.publishes).toBe(0);
      expect(baseline?.before.generations).toBe(9);
    });

    it("degrades a malformed baseline to none rather than serving it", async () => {
      writeFileSync(
        join(dataDir, "metrics.json"),
        JSON.stringify({ generations: 3, field_regenerations: {}, baseline: { at: 42 } }),
        "utf8",
      );
      const m = await freshMetrics();
      // The counters still load; only the comparison nobody can vouch for goes.
      expect(m.metricsSnapshot().generations).toBe(3);
      expect(m.metricsSnapshot().baseline).toBeNull();
    });

    it("leaves a metrics file written before baselines existed reporting none", async () => {
      writeFileSync(
        join(dataDir, "metrics.json"),
        JSON.stringify({ generations: 9, field_regenerations: {}, publishes: 4, rsvps: 5 }),
        "utf8",
      );
      const m = await freshMetrics();
      expect(m.metricsSnapshot().baseline).toBeNull();

      // Taking one later freezes what the old file had accumulated, which is
      // the whole point: the "before" period predates this code.
      m.markBaseline("auth-gate");
      expect(m.metricsSnapshot().baseline?.before.generations).toBe(9);
      expect(JSON.parse(readFileSync(join(dataDir, "metrics.json"), "utf8")).generations).toBe(9);
    });
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
