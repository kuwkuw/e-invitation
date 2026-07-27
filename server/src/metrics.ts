// Product metrics. The spec's per-request log line (task, model, cost,
// latency) is emitted by the gateway; this tracks the regenerate-rate — how
// often users reject generated copy, the main quality signal — and the
// publish-rate. Counters persist to DATA_DIR/metrics.json (write-then-rename,
// like store.ts) so the KPIs survive restarts and deploys.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GenerateSource } from "./schemas.js";
import { dataDir } from "./store.js";

interface Counters {
  generations: number;
  field_regenerations: Record<string, number>;
  backgrounds: number;
  publishes: number;
  rsvps: number;
  // Share-loop instrumentation (adr-013): unique-browser guest-page views, and
  // the generations that began on a guest page rather than cold.
  invitation_views: number;
  referred_generations: number;
}

let counters: Counters | null = null;

function metricsPath(): string {
  return join(dataDir(), "metrics.json");
}

// Every counter that is a plain number, read back from disk by one loop.
// `field_regenerations` is the only one that isn't, and it is handled apart.
// Adding a counter means adding it here and nowhere else in the loader.
const SCALAR_COUNTERS = [
  "generations",
  "backgrounds",
  "publishes",
  "rsvps",
  "invitation_views",
  "referred_generations",
] as const satisfies readonly (keyof Counters)[];

// Loaded lazily on first use (so tests can set DATA_DIR first). A missing or
// corrupt file starts the counters fresh rather than refusing to serve.
function load(): Counters {
  if (counters) return counters;
  counters = {
    generations: 0,
    field_regenerations: {},
    backgrounds: 0,
    publishes: 0,
    rsvps: 0,
    invitation_views: 0,
    referred_generations: 0,
  };
  try {
    if (existsSync(metricsPath())) {
      const stored = JSON.parse(readFileSync(metricsPath(), "utf8")) as Partial<Counters>;
      // A key absent from the file keeps its zero, which is what lets a
      // metrics.json written before a new counter existed upgrade in place —
      // the counters it already carries survive, the new one starts at 0.
      for (const key of SCALAR_COUNTERS) {
        const value = stored[key];
        if (typeof value === "number") counters[key] = value;
      }
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

/** One generation, tagged with where the host arrived from (adr-013 §3). A
 *  referred generation counts in both totals — it is a generation like any
 *  other, and additionally the share loop having worked once. */
export function recordGeneration(source: GenerateSource = "direct"): void {
  const current = load();
  current.generations += 1;
  if (source === "guest") current.referred_generations += 1;
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

/** One unique-browser view of a guest page (adr-013). Called only after the
 *  route has confirmed the invitation exists and the beacon is not a repeat. */
export function recordInvitationView(): void {
  const current = load();
  current.invitation_views += 1;
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
    invitation_views: current.invitation_views,
    referred_generations: current.referred_generations,
    // The share loop, per published invitation. `new_hosts_per_publish` is the
    // number 07-monetization §5.1 gates every commercial option on: under ~0.3
    // no pricing model rescues the economics, over ~0.7 acquisition is
    // effectively free. `views_per_publish` is the funnel step above it —
    // how many people a share link actually reaches.
    views_per_publish: current.publishes === 0 ? 0 : current.invitation_views / current.publishes,
    new_hosts_per_publish:
      current.publishes === 0 ? 0 : current.referred_generations / current.publishes,
  };
}
