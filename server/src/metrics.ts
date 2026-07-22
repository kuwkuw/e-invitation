// Product metrics. The spec's per-request log line (task, model, cost,
// latency) is emitted by the gateway; this tracks the regenerate-rate — how
// often users reject generated copy, the main quality signal — and the
// publish-rate. Counters persist to DATA_DIR/metrics.json (write-then-rename,
// like store.ts) so the KPIs survive restarts and deploys.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./store.js";

interface Counters {
  generations: number;
  field_regenerations: Record<string, number>;
  backgrounds: number;
  publishes: number;
  rsvps: number;
}

let counters: Counters | null = null;

function metricsPath(): string {
  return join(dataDir(), "metrics.json");
}

// Loaded lazily on first use (so tests can set DATA_DIR first). A missing or
// corrupt file starts the counters fresh rather than refusing to serve.
function load(): Counters {
  if (counters) return counters;
  counters = { generations: 0, field_regenerations: {}, backgrounds: 0, publishes: 0, rsvps: 0 };
  try {
    if (existsSync(metricsPath())) {
      const stored = JSON.parse(readFileSync(metricsPath(), "utf8")) as Partial<Counters>;
      if (typeof stored.generations === "number") counters.generations = stored.generations;
      if (typeof stored.backgrounds === "number") counters.backgrounds = stored.backgrounds;
      if (typeof stored.publishes === "number") counters.publishes = stored.publishes;
      if (typeof stored.rsvps === "number") counters.rsvps = stored.rsvps;
      for (const [field, count] of Object.entries(stored.field_regenerations ?? {})) {
        if (typeof count === "number") counters.field_regenerations[field] = count;
      }
    }
  } catch {
    // start fresh
  }
  return counters;
}

function save(current: Counters): void {
  mkdirSync(dataDir(), { recursive: true });
  const path = metricsPath();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(current, null, 2), "utf8");
  renameSync(tmp, path);
}

export function recordGeneration(): void {
  const current = load();
  current.generations += 1;
  save(current);
}

export function recordFieldRegeneration(field: string): void {
  const current = load();
  current.field_regenerations[field] = (current.field_regenerations[field] ?? 0) + 1;
  save(current);
}

export function recordBackground(): void {
  const current = load();
  current.backgrounds += 1;
  save(current);
}

export function recordPublish(): void {
  const current = load();
  current.publishes += 1;
  save(current);
}

export function recordRsvp(): void {
  const current = load();
  current.rsvps += 1;
  save(current);
}

export function metricsSnapshot() {
  const current = load();
  const totalRegens = Object.values(current.field_regenerations).reduce((a, b) => a + b, 0);
  return {
    generations: current.generations,
    field_regenerations: { ...current.field_regenerations },
    regenerate_rate: current.generations === 0 ? 0 : totalRegens / current.generations,
    backgrounds: current.backgrounds,
    publishes: current.publishes,
    publish_rate: current.generations === 0 ? 0 : current.publishes / current.generations,
    rsvps: current.rsvps,
  };
}
