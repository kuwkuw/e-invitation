// In-process product metrics. The spec's per-request log line (task, model,
// cost, latency) is emitted by the gateway; this tracks the regenerate-rate —
// how often users reject generated copy — the main quality signal.

const counters = {
  generations: 0,
  field_regenerations: {} as Record<string, number>,
};

export function recordGeneration(): void {
  counters.generations += 1;
}

export function recordFieldRegeneration(field: string): void {
  counters.field_regenerations[field] = (counters.field_regenerations[field] ?? 0) + 1;
}

export function metricsSnapshot() {
  const totalRegens = Object.values(counters.field_regenerations).reduce((a, b) => a + b, 0);
  return {
    generations: counters.generations,
    field_regenerations: { ...counters.field_regenerations },
    regenerate_rate: counters.generations === 0 ? 0 : totalRegens / counters.generations,
  };
}
