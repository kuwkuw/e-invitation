// Operator-cost guardrails (ADR-008): per-IP daily allowances on the two
// LLM-backed endpoints, plus a daily global spend circuit breaker fed by the
// gateway's per-request cost estimates. BYOK requests bypass both — they
// spend the caller's key, not the operator's.
//
// State is in-process, same as metrics: the NFR-7 single-process assumption.
// An allowance is consumed when the request is admitted (before the LLM
// call), so failed generations count too — otherwise hammering a failing
// pipeline would be free.

export type LimitedTask = "generation" | "regeneration" | "background";

// Read lazily so tests (and operators) can change limits via env without a
// rebuild. 0 disables a guardrail. Backgrounds are an order of magnitude
// pricier than text (adr-009), so their allowance is an order tighter.
const LIMIT_ENV: Record<LimitedTask, { env: string; fallback: number }> = {
  generation: { env: "LIMIT_GENERATIONS_PER_DAY", fallback: 10 },
  regeneration: { env: "LIMIT_REGENERATIONS_PER_DAY", fallback: 30 },
  background: { env: "LIMIT_BACKGROUNDS_PER_DAY", fallback: 3 },
};

function limitFor(task: LimitedTask): number {
  const { env, fallback } = LIMIT_ENV[task];
  const raw = process.env[env];
  const parsed = raw === undefined ? fallback : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function dailyBudgetUsd(): number {
  const parsed = process.env.DAILY_BUDGET_USD === undefined ? 5 : Number(process.env.DAILY_BUDGET_USD);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC day
}

interface IpUsage {
  day: string;
  generation: number;
  regeneration: number;
  background: number;
}

const ipUsage = new Map<string, IpUsage>();
let usageDay = today();
let spend = { day: today(), usd: 0 };

// All entries go stale together at UTC midnight; clearing the map then keeps
// it from growing beyond one day's worth of distinct IPs.
function rollover(): void {
  const day = today();
  if (usageDay !== day) {
    ipUsage.clear();
    usageDay = day;
  }
  if (spend.day !== day) {
    spend = { day, usd: 0 };
  }
}

/** Admit-or-reject one request from `ip`; admission consumes one unit of the
 *  day's allowance. A limit of 0 disables the check. */
export function consumeIpAllowance(ip: string, task: LimitedTask): boolean {
  const limit = limitFor(task);
  if (limit === 0) return true;
  rollover();
  const usage = ipUsage.get(ip) ?? { day: usageDay, generation: 0, regeneration: 0, background: 0 };
  if (usage[task] >= limit) return false;
  usage[task] += 1;
  ipUsage.set(ip, usage);
  return true;
}

/** Called by the gateway after each successful operator-key LLM request. */
export function recordOperatorSpend(costUsd: number | null): void {
  if (costUsd === null || !(costUsd > 0)) return;
  rollover();
  spend.usd += costUsd;
}

export function budgetExhausted(): boolean {
  const budget = dailyBudgetUsd();
  if (budget === 0) return false;
  rollover();
  return spend.usd >= budget;
}

/** Operational snapshot for /healthz: what the limits are and where today's
 *  spend stands. Rounded — the raw numbers are estimates already. */
export function guardrailsSnapshot() {
  rollover();
  const budget = dailyBudgetUsd();
  return {
    limits: {
      generations_per_ip_per_day: limitFor("generation"),
      regenerations_per_ip_per_day: limitFor("regeneration"),
      backgrounds_per_ip_per_day: limitFor("background"),
    },
    budget: {
      daily_usd: budget,
      spent_today_usd: Math.round(spend.usd * 1e6) / 1e6,
      exhausted: budgetExhausted(),
    },
  };
}

/** Test hook: drop all in-process guardrail state. */
export function resetGuardrails(): void {
  ipUsage.clear();
  usageDay = today();
  spend = { day: usageDay, usd: 0 };
}
