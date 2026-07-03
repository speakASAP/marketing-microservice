export type OrderAffinityScheduleCadence = "daily" | "hourly";

export interface OrderAffinitySchedulePolicyInput {
  schedule?: OrderAffinityScheduleCadence;
  scheduleAt?: string;
  lookback?: number;
  windowDelayMinutes?: number;
  sourceOwner?: string;
  channel?: string;
}

export interface OrderAffinitySchedulePolicyResult {
  schedule: OrderAffinityScheduleCadence;
  runId: string;
  from: string;
  to: string;
  sourceOwner: string;
  channel: string;
}

const DEFAULT_WINDOW_DELAY_MINUTES = 15;

export function applyOrderAffinitySchedulePolicy<T extends { runId?: string; from?: string; to?: string; sourceOwner?: string; channel?: string }>(
  options: T & OrderAffinitySchedulePolicyInput,
  now: Date = new Date()
): T & Partial<OrderAffinitySchedulePolicyResult> {
  if (!options.schedule) return options;
  const policy = buildOrderAffinitySchedulePolicy(options, now);
  return {
    ...options,
    runId: options.runId || policy.runId,
    from: options.from || policy.from,
    to: options.to || policy.to,
    sourceOwner: options.sourceOwner || policy.sourceOwner,
    channel: options.channel || policy.channel,
  };
}

export function buildOrderAffinitySchedulePolicy(
  input: OrderAffinitySchedulePolicyInput,
  now: Date = new Date()
): OrderAffinitySchedulePolicyResult {
  const schedule = input.schedule;
  if (schedule !== "daily" && schedule !== "hourly") {
    throw new Error("order_affinity_schedule_invalid");
  }
  const anchor = parseAnchor(input.scheduleAt, now);
  const delayMs = positiveInteger(input.windowDelayMinutes, DEFAULT_WINDOW_DELAY_MINUTES) * 60 * 1000;
  const delayed = new Date(anchor.getTime() - delayMs);
  const lookback = positiveInteger(input.lookback, 1);
  const window = schedule === "daily"
    ? dailyWindow(delayed, lookback)
    : hourlyWindow(delayed, lookback);
  const sourceOwner = normalizeComponent(input.sourceOwner || "orders-microservice", "sourceOwner");
  const channel = normalizeComponent(input.channel || "", "channel");
  return {
    schedule,
    runId: `order-affinity:${sourceOwner}:${channel}:${schedule}:${stamp(window.from)}:${stamp(window.to)}`,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    sourceOwner,
    channel,
  };
}

function dailyWindow(anchor: Date, lookbackDays: number): { from: Date; to: Date } {
  const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 0, 0, 0, 0));
  const from = new Date(to.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return { from, to };
}

function hourlyWindow(anchor: Date, lookbackHours: number): { from: Date; to: Date } {
  const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), anchor.getUTCHours(), 0, 0, 0));
  const from = new Date(to.getTime() - lookbackHours * 60 * 60 * 1000);
  return { from, to };
}

function parseAnchor(value: string | undefined, fallback: Date): Date {
  const parsed = value ? new Date(value) : fallback;
  if (Number.isNaN(parsed.getTime())) throw new Error("order_affinity_schedule_at_invalid");
  return parsed;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeComponent(value: string, field: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_.:-]/g, "-").slice(0, 120);
  if (!normalized) throw new Error(`order_affinity_schedule_${field}_missing`);
  return normalized;
}

function stamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.000Z$/, "Z");
}
