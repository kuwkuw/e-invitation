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
  // Not a counter — the frozen "counters as they stood" snapshot (adr-014 §2).
  // Handled apart from SCALAR_COUNTERS in the loader, like field_regenerations.
  baseline: Baseline | null;
}

/** The rate inputs, flattened — `field_regenerations` collapsed to its total.
 *  This is what a baseline freezes and what every derived rate is computed
 *  from, so lifetime, pre-gate and post-gate figures cannot drift apart. */
interface CounterTotals {
  generations: number;
  field_regenerations: number;
  backgrounds: number;
  publishes: number;
  rsvps: number;
  invitation_views: number;
  referred_generations: number;
}

interface Baseline {
  at: string;
  reason: string;
  counters: CounterTotals;
}

const TOTAL_KEYS = [
  "generations",
  "field_regenerations",
  "backgrounds",
  "publishes",
  "rsvps",
  "invitation_views",
  "referred_generations",
] as const satisfies readonly (keyof CounterTotals)[];

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
    baseline: null,
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
      counters.baseline = readBaseline(stored.baseline);
    }
  } catch {
    // start fresh
  }
  return counters;
}

// Validated field by field rather than trusted: a half-written baseline must
// degrade to "no baseline" — the file's existing posture — because the
// alternative is serving a comparison against numbers nobody can vouch for.
function readBaseline(value: unknown): Baseline | null {
  if (!value || typeof value !== "object") return null;
  const { at, reason, counters } = value as Record<string, unknown>;
  if (typeof at !== "string" || typeof reason !== "string") return null;
  if (!counters || typeof counters !== "object") return null;
  const stored = counters as Record<string, unknown>;
  const frozen = {
    generations: 0,
    field_regenerations: 0,
    backgrounds: 0,
    publishes: 0,
    rsvps: 0,
    invitation_views: 0,
    referred_generations: 0,
  };
  for (const key of TOTAL_KEYS) {
    const n = stored[key];
    if (typeof n === "number") frozen[key] = n;
  }
  return { at, reason, counters: frozen };
}

/** Drop the cached counters so the next call reloads from disk — what a
 *  restart does for real. Tests give each case its own DATA_DIR, and a
 *  process-lifetime cache would otherwise carry one case's numbers, and its
 *  frozen baseline, into the next. */
export function resetMetricsCache(): void {
  counters = null;
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

/** Freeze the counters as they stand, once (adr-014 §2). Called when the
 *  publish gate turns on: gating publishes moves `publish_rate` and
 *  `new_hosts_per_publish` for a reason that has nothing to do with copy
 *  quality or the share loop, and 07-monetization §5.1's 0.3/0.7 thresholds
 *  were written against an ungated denominator. Without a frozen "before",
 *  the two periods are one blended number and neither is readable.
 *
 *  Idempotent, because the caller runs at boot: re-freezing on every restart
 *  would keep resetting the "before" to the current numbers and erase the
 *  comparison this exists to make. */
export function markBaseline(reason: string): Baseline {
  const current = load();
  if (current.baseline) return current.baseline;
  current.baseline = { at: new Date().toISOString(), reason, counters: totals(current) };
  save(current);
  return current.baseline;
}

function totals(current: Counters): CounterTotals {
  return {
    generations: current.generations,
    field_regenerations: Object.values(current.field_regenerations).reduce((a, b) => a + b, 0),
    backgrounds: current.backgrounds,
    publishes: current.publishes,
    rsvps: current.rsvps,
    invitation_views: current.invitation_views,
    referred_generations: current.referred_generations,
  };
}

// Clamped at zero: a metrics.json restored from a backup older than its own
// baseline would otherwise report negative activity, which reads as a broken
// deploy rather than as the stale file it is.
function elapsed(now: CounterTotals, then: CounterTotals): CounterTotals {
  const delta = { ...now };
  for (const key of TOTAL_KEYS) delta[key] = Math.max(0, now[key] - then[key]);
  return delta;
}

/** Every derived rate, computed in one place — adr-012 §3's "one counting
 *  implementation" applied to metrics. Lifetime, pre-gate and post-gate all
 *  come through here, so a rate cannot mean one thing in one block and
 *  something else in another.
 *
 *  `new_hosts_per_publish` is the number 07-monetization §5.1 gates every
 *  commercial option on: under ~0.3 no pricing model rescues the economics,
 *  over ~0.7 acquisition is effectively free. `views_per_publish` is the
 *  funnel step above it — how many people a share link actually reaches. */
function rates(t: CounterTotals) {
  return {
    regenerate_rate: t.generations === 0 ? 0 : t.field_regenerations / t.generations,
    publish_rate: t.generations === 0 ? 0 : t.publishes / t.generations,
    views_per_publish: t.publishes === 0 ? 0 : t.invitation_views / t.publishes,
    new_hosts_per_publish: t.publishes === 0 ? 0 : t.referred_generations / t.publishes,
  };
}

// null until a baseline is taken, so /api/metrics keeps its current shape for
// every deployment that never gates publishing (adr-014 §7).
function baselineBlock(current: Counters) {
  const baseline = current.baseline;
  if (!baseline) return null;
  const before = baseline.counters;
  const after = elapsed(totals(current), before);
  return {
    at: baseline.at,
    reason: baseline.reason,
    before: { ...before, ...rates(before) },
    since: { ...after, ...rates(after) },
  };
}

export function metricsSnapshot() {
  const current = load();
  const lifetime = rates(totals(current));
  return {
    generations: current.generations,
    field_regenerations: { ...current.field_regenerations },
    regenerate_rate: lifetime.regenerate_rate,
    backgrounds: current.backgrounds,
    publishes: current.publishes,
    publish_rate: lifetime.publish_rate,
    rsvps: current.rsvps,
    invitation_views: current.invitation_views,
    referred_generations: current.referred_generations,
    views_per_publish: lifetime.views_per_publish,
    new_hosts_per_publish: lifetime.new_hosts_per_publish,
    baseline: baselineBlock(current),
  };
}
