import { Pool } from "pg";
import type { OrderAffinityBackfillSummary } from "./order-affinity-backfill";

export type OrderAffinityRunMode = "dry-run" | "publish";
export type OrderAffinityRunStatus = "planned" | "running" | "dry_run_passed" | "published" | "failed" | "blocked";

export interface OrderAffinityRunLedgerContext {
  sourceOwner: string;
  channel: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  cursorBefore?: string | null;
  cursorAfter?: string | null;
  mode: OrderAffinityRunMode;
  status?: OrderAffinityRunStatus;
  batchCount?: number;
  createdBy?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  completeSnapshot?: boolean;
}

export interface OrderAffinityIdempotencyKeyContext {
  runId: string;
  sourceOwner: string;
  channel: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  batchCount: number;
}

export interface OrderAffinityRunLedgerEntry {
  runId: string;
  sourceOwner: string;
  channel: string;
  windowStart: string | null;
  windowEnd: string | null;
  cursorBefore: string | null;
  cursorAfter: string | null;
  mode: OrderAffinityRunMode;
  status: OrderAffinityRunStatus;
  inputRecords: number;
  acceptedCreatedEvents: number;
  rejectedRecords: number;
  skippedEvents: number;
  aggregatePairs: number;
  totalPairEvidence: number;
  batchCount: number;
  rejectionReasons: Record<string, number>;
  byChannel: Record<string, number>;
  catalogIdempotencyKeys: string[];
  completeSnapshot: boolean;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OrderAffinityRunLedgerOptions {
  enabled: boolean;
  databaseUrl?: string;
  dbHost?: string;
  dbPort?: string;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
}

export interface OrderAffinityRunLedgerRecordResult {
  status: "disabled" | "recorded" | "skipped_missing_config" | "failed";
  runId: string;
  idempotencyKeyCount: number;
  reason?: string;
}

export function buildOrderAffinityRunLedgerEntry(
  summary: OrderAffinityBackfillSummary,
  context: OrderAffinityRunLedgerContext
): OrderAffinityRunLedgerEntry {
  const batchCount = Math.max(0, Math.trunc(context.batchCount ?? (summary.candidates.length > 0 ? 1 : 0)));
  const status = context.status ?? (context.mode === "dry-run" ? "dry_run_passed" : "planned");
  const createdAt = new Date().toISOString();

  return {
    runId: summary.runId,
    sourceOwner: normalizeRequired(context.sourceOwner, "sourceOwner"),
    channel: normalizeRequired(context.channel, "channel"),
    windowStart: normalizeOptionalIso(context.windowStart),
    windowEnd: normalizeOptionalIso(context.windowEnd),
    cursorBefore: normalizeOptional(context.cursorBefore),
    cursorAfter: normalizeOptional(context.cursorAfter),
    mode: context.mode,
    status,
    inputRecords: summary.inputRecords,
    acceptedCreatedEvents: summary.acceptedCreatedEvents,
    rejectedRecords: summary.rejectedRecords,
    skippedEvents: summary.skippedEvents,
    aggregatePairs: summary.aggregatePairs,
    totalPairEvidence: summary.totalPairEvidence,
    batchCount,
    rejectionReasons: summary.rejectionReasons,
    byChannel: summary.byChannel,
    catalogIdempotencyKeys: buildCatalogIdempotencyKeys({
      runId: summary.runId,
      sourceOwner: normalizeRequired(context.sourceOwner, "sourceOwner"),
      channel: normalizeRequired(context.channel, "channel"),
      windowStart: normalizeOptionalIso(context.windowStart),
      windowEnd: normalizeOptionalIso(context.windowEnd),
      batchCount,
    }),
    completeSnapshot: context.completeSnapshot === true,
    createdBy: normalizeOptional(context.createdBy) ?? "marketing-microservice",
    createdAt,
    startedAt: normalizeOptionalIso(context.startedAt),
    completedAt: normalizeOptionalIso(context.completedAt) ?? (status === "dry_run_passed" || status === "published" || status === "failed" || status === "blocked" ? createdAt : null),
  };
}

export function buildCatalogIdempotencyKeys(input: OrderAffinityIdempotencyKeyContext): string[] {
  const runId = normalizeRequired(input.runId, "runId");
  const sourceOwner = normalizeRequired(input.sourceOwner, "sourceOwner");
  const channel = normalizeRequired(input.channel, "channel");
  const windowStart = normalizeWindowComponent(input.windowStart, "window-start-missing");
  const windowEnd = normalizeWindowComponent(input.windowEnd, "window-end-missing");
  return Array.from(
    { length: Math.max(0, Math.trunc(input.batchCount)) },
    (_value, index) => `marketing_order_affinity:${sourceOwner}:${channel}:${windowStart}:${windowEnd}:${runId}:${index + 1}`
  );
}

export function orderAffinityRunLedgerOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): OrderAffinityRunLedgerOptions {
  return {
    enabled: env.ORDER_AFFINITY_RUN_LEDGER_ENABLED === "true",
    databaseUrl: normalizeOptional(env.ORDER_AFFINITY_LEDGER_DATABASE_URL || env.DATABASE_URL) ?? undefined,
    dbHost: normalizeOptional(env.DB_HOST) ?? undefined,
    dbPort: normalizeOptional(env.DB_PORT) ?? undefined,
    dbUser: normalizeOptional(env.DB_USER) ?? undefined,
    dbPassword: normalizeOptional(env.DB_PASSWORD) ?? undefined,
    dbName: normalizeOptional(env.DB_NAME) ?? undefined,
  };
}

export async function recordOrderAffinityRunLedger(
  entry: OrderAffinityRunLedgerEntry,
  options: OrderAffinityRunLedgerOptions = orderAffinityRunLedgerOptionsFromEnv(),
  pool?: Pool
): Promise<OrderAffinityRunLedgerRecordResult> {
  if (!options.enabled) {
    return { status: "disabled", runId: entry.runId, idempotencyKeyCount: entry.catalogIdempotencyKeys.length, reason: "ledger_disabled" };
  }
  if (!pool && !hasDatabaseConfig(options)) {
    return { status: "skipped_missing_config", runId: entry.runId, idempotencyKeyCount: entry.catalogIdempotencyKeys.length, reason: "ledger_database_config_missing" };
  }

  const ownedPool = pool ?? new Pool(getPoolConfig(options));
  const client = await ownedPool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into marketing_order_affinity_runs (
        run_id, source_owner, channel, window_start, window_end, cursor_before, cursor_after,
        mode, status, input_records, accepted_created_events, rejected_records, skipped_events,
        aggregate_pairs, total_pair_evidence, batch_count, rejection_reasons, by_channel,
        catalog_idempotency_keys, complete_snapshot, created_by, created_at, started_at, completed_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19::jsonb, $20, $21, $22, $23, $24, now())
      on conflict (run_id) do update set
        source_owner = excluded.source_owner,
        channel = excluded.channel,
        window_start = excluded.window_start,
        window_end = excluded.window_end,
        cursor_before = excluded.cursor_before,
        cursor_after = excluded.cursor_after,
        mode = excluded.mode,
        status = excluded.status,
        input_records = excluded.input_records,
        accepted_created_events = excluded.accepted_created_events,
        rejected_records = excluded.rejected_records,
        skipped_events = excluded.skipped_events,
        aggregate_pairs = excluded.aggregate_pairs,
        total_pair_evidence = excluded.total_pair_evidence,
        batch_count = excluded.batch_count,
        rejection_reasons = excluded.rejection_reasons,
        by_channel = excluded.by_channel,
        catalog_idempotency_keys = excluded.catalog_idempotency_keys,
        complete_snapshot = excluded.complete_snapshot,
        created_by = excluded.created_by,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        updated_at = now()`,
      [
        entry.runId,
        entry.sourceOwner,
        entry.channel,
        entry.windowStart,
        entry.windowEnd,
        entry.cursorBefore,
        entry.cursorAfter,
        entry.mode,
        entry.status,
        entry.inputRecords,
        entry.acceptedCreatedEvents,
        entry.rejectedRecords,
        entry.skippedEvents,
        entry.aggregatePairs,
        entry.totalPairEvidence,
        entry.batchCount,
        JSON.stringify(entry.rejectionReasons),
        JSON.stringify(entry.byChannel),
        JSON.stringify(entry.catalogIdempotencyKeys),
        entry.completeSnapshot,
        entry.createdBy,
        entry.createdAt,
        entry.startedAt,
        entry.completedAt,
      ]
    );
    await client.query("delete from marketing_order_affinity_idempotency_keys where run_id = $1", [entry.runId]);
    for (let index = 0; index < entry.catalogIdempotencyKeys.length; index += 1) {
      await client.query(
        `insert into marketing_order_affinity_idempotency_keys (idempotency_key, run_id, batch_index, source_owner, channel, window_start, window_end)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (idempotency_key) do update set run_id = excluded.run_id, batch_index = excluded.batch_index`,
        [
          entry.catalogIdempotencyKeys[index],
          entry.runId,
          index + 1,
          entry.sourceOwner,
          entry.channel,
          entry.windowStart,
          entry.windowEnd,
        ]
      );
    }
    await client.query("commit");
    return { status: "recorded", runId: entry.runId, idempotencyKeyCount: entry.catalogIdempotencyKeys.length };
  } catch (error) {
    await client.query("rollback");
    return {
      status: "failed",
      runId: entry.runId,
      idempotencyKeyCount: entry.catalogIdempotencyKeys.length,
      reason: error instanceof Error ? error.message : "order_affinity_ledger_record_failed",
    };
  } finally {
    client.release();
    if (!pool) await ownedPool.end();
  }
}

function hasDatabaseConfig(options: OrderAffinityRunLedgerOptions): boolean {
  return Boolean(options.databaseUrl || (options.dbHost && options.dbName));
}

function getPoolConfig(options: OrderAffinityRunLedgerOptions): { connectionString?: string; host?: string; port?: number; user?: string; password?: string; database?: string } {
  if (options.databaseUrl) return { connectionString: options.databaseUrl };
  return {
    host: options.dbHost,
    port: options.dbPort ? Number(options.dbPort) : undefined,
    user: options.dbUser,
    password: options.dbPassword,
    database: options.dbName,
  };
}

function normalizeRequired(value: string | null | undefined, field: string): string {
  const normalized = normalizeOptional(value);
  if (!normalized) throw new Error(`order_affinity_ledger_${field}_missing`);
  return normalized.replace(/[^a-zA-Z0-9_.:-]/g, "-").slice(0, 160);
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeOptionalIso(value: string | null | undefined): string | null {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error("order_affinity_ledger_window_invalid");
  return parsed.toISOString();
}


function normalizeWindowComponent(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeOptionalIso(value);
  return normalized ? normalizeRequired(normalized, "window") : fallback;
}
