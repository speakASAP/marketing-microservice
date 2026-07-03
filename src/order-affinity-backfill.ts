import fs from "node:fs";
import axios from "axios";
import {
  CATALOG_ORDER_AFFINITY_SOURCE,
  ORDERS_ORDER_CREATED_V1,
  CatalogProductRelationUpsertCandidate,
  OrdersLifecycleSignal,
  parseOrdersLifecycleEvent
} from "./order-lifecycle-events";
import {
  OrderAffinityCatalogPublishResult,
  orderAffinityCatalogPublisherOptionsFromEnv,
  publishOrderAffinityCandidatesToCatalog
} from "./order-affinity-catalog-publisher";
import {
  OrderAffinityRunLedgerEntry,
  OrderAffinityRunLedgerRecordResult,
  OrderAffinityRunStatus,
  buildOrderAffinityRunLedgerEntry,
  recordOrderAffinityRunLedger
} from "./order-affinity-ledger";
import {
  OrderAffinityScheduleCadence,
  applyOrderAffinitySchedulePolicy
} from "./order-affinity-schedule-policy";

export interface OrderAffinityBackfillOptions {
  limit?: number;
  runId?: string;
}

export interface OrderAffinityPublishWindowOptions {
  sourceOwner: string;
  channel: string;
  windowStart: string;
  windowEnd: string;
  completeSnapshot: boolean;
  ownerRetentionPolicyRef?: string;
}

export interface OrderAffinityBackfillSummary {
  runId: string;
  inputRecords: number;
  acceptedCreatedEvents: number;
  rejectedRecords: number;
  skippedEvents: number;
  aggregatePairs: number;
  totalPairEvidence: number;
  candidates: CatalogProductRelationUpsertCandidate[];
  rejectionReasons: Record<string, number>;
  byChannel: Record<string, number>;
}

interface AggregatedPair {
  sourceProductId: string;
  targetProductId: string;
  score: number;
  channels: Set<string>;
  currencies: Set<string>;
  maxProductCount: number;
}

interface CliOptions extends OrderAffinityBackfillOptions {
  file?: string;
  ordersUrl?: string;
  marketplaceUrl?: string;
  sourceOwner?: string;
  channel?: string;
  from?: string;
  to?: string;
  cursorBefore?: string;
  cursorAfter?: string;
  createdBy?: string;
  schedule?: OrderAffinityScheduleCadence;
  scheduleAt?: string;
  lookback?: number;
  windowDelayMinutes?: number;
  recordLedger: boolean;
  publish: boolean;
  replaceWindow: boolean;
  completeSnapshot: boolean;
  ownerRetentionPolicyRef?: string;
  pretty: boolean;
}

export function buildOrderAffinityBackfill(
  records: unknown[],
  options: OrderAffinityBackfillOptions = {}
): OrderAffinityBackfillSummary {
  const runId = normalizeRunId(options.runId || `orders-history-${new Date().toISOString().slice(0, 10)}`);
  const limit = positiveInteger(options.limit, records.length || 1);
  const rejectionReasons: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const pairs = new Map<string, AggregatedPair>();
  let acceptedCreatedEvents = 0;
  let rejectedRecords = 0;
  let skippedEvents = 0;

  for (const rawRecord of records.slice(0, limit)) {
    const event = extractEventEnvelope(rawRecord);
    const parsed = parseOrdersLifecycleEvent(event);
    if (!parsed.ok) {
      rejectedRecords += 1;
      increment(rejectionReasons, parsed.reason);
      continue;
    }
    if (parsed.signal.eventType !== ORDERS_ORDER_CREATED_V1) {
      skippedEvents += 1;
      continue;
    }
    const productIds = uniqueCatalogProductIds(parsed.signal.productRefs);
    if (productIds.length < 2) {
      skippedEvents += 1;
      increment(rejectionReasons, "created_event_less_than_two_catalog_products");
      continue;
    }

    acceptedCreatedEvents += 1;
    increment(byChannel, parsed.signal.channel || "unknown");
    for (const sourceProductId of productIds) {
      for (const targetProductId of productIds) {
        if (sourceProductId === targetProductId) continue;
        const key = `${sourceProductId}->${targetProductId}`;
        const pair = pairs.get(key) || {
          sourceProductId,
          targetProductId,
          score: 0,
          channels: new Set<string>(),
          currencies: new Set<string>(),
          maxProductCount: productIds.length
        };
        pair.score += 1;
        pair.maxProductCount = Math.max(pair.maxProductCount, productIds.length);
        if (parsed.signal.channel) pair.channels.add(parsed.signal.channel);
        if (parsed.signal.currency) pair.currencies.add(parsed.signal.currency);
        pairs.set(key, pair);
      }
    }
  }

  const candidates = Array.from(pairs.values())
    .sort((left, right) => right.score - left.score || left.sourceProductId.localeCompare(right.sourceProductId) || left.targetProductId.localeCompare(right.targetProductId))
    .map((pair) => toBackfillCandidate(pair, runId));

  return {
    runId,
    inputRecords: Math.min(records.length, limit),
    acceptedCreatedEvents,
    rejectedRecords,
    skippedEvents,
    aggregatePairs: candidates.length,
    totalPairEvidence: candidates.reduce((sum, candidate) => sum + candidate.score, 0),
    candidates,
    rejectionReasons: sortedRecord(rejectionReasons),
    byChannel: sortedRecord(byChannel)
  };
}

export async function publishOrderAffinityBackfill(
  summary: OrderAffinityBackfillSummary,
  ledger?: OrderAffinityRunLedgerEntry,
  mode: "batch" | "replace-window" = "batch"
) {
  const signal: OrdersLifecycleSignal = {
    eventType: ORDERS_ORDER_CREATED_V1,
    eventVersion: 1,
    eventId: `backfill:${summary.runId}`,
    occurredAt: new Date().toISOString(),
    orderId: `backfill:${summary.runId}`
  };
  return publishOrderAffinityCandidatesToCatalog(
    signal,
    summary.candidates,
    orderAffinityCatalogPublisherOptionsFromEnv(),
    undefined,
    ledger ? {
      idempotencyKeys: ledger.catalogIdempotencyKeys,
      ...(mode === "replace-window" && ledger.windowStart && ledger.windowEnd ? {
        replaceWindow: {
          sourceOwner: ledger.sourceOwner,
          channel: ledger.channel,
          windowStart: ledger.windowStart,
          windowEnd: ledger.windowEnd,
          runId: ledger.runId,
        }
      } : {})
    } : {}
  );
}

export function chooseOrderAffinityCatalogPublishMode(
  summary: OrderAffinityBackfillSummary,
  ledger: OrderAffinityRunLedgerEntry,
  options: { replaceWindow?: boolean; completeSnapshot?: boolean; ownerRetentionPolicyRef?: string | null }
): { mode: "batch" | "replace-window" | "replace-window-blocked"; reason?: string } {
  if (!options.replaceWindow) return { mode: "batch" };
  if (summary.rejectedRecords > 0) return { mode: "replace-window-blocked", reason: "replace_window_requires_zero_parser_rejects" };
  if (!ledger.windowStart || !ledger.windowEnd) return { mode: "replace-window-blocked", reason: "replace_window_requires_source_window" };
  if (!options.completeSnapshot) return { mode: "replace-window-blocked", reason: "replace_window_requires_complete_snapshot_ledger" };
  if (!options.ownerRetentionPolicyRef?.trim()) return { mode: "replace-window-blocked", reason: "replace_window_requires_owner_retention_policy" };
  return { mode: "replace-window" };
}

export function buildOrderAffinityBackfillLedgerEntry(
  summary: OrderAffinityBackfillSummary,
  options: OrderAffinityBackfillOptions & {
    sourceOwner?: string;
    channel?: string;
    from?: string;
    to?: string;
    cursorBefore?: string;
    cursorAfter?: string;
    publish?: boolean;
    status?: OrderAffinityRunStatus;
    createdBy?: string;
    batchCount?: number;
    marketplaceUrl?: string;
    ordersUrl?: string;
  } = {}
): OrderAffinityRunLedgerEntry {
  return buildOrderAffinityRunLedgerEntry(summary, {
    sourceOwner: options.sourceOwner || inferSourceOwner(options),
    channel: options.channel || inferChannel(summary),
    windowStart: options.from || null,
    windowEnd: options.to || null,
    cursorBefore: options.cursorBefore || null,
    cursorAfter: options.cursorAfter || null,
    mode: options.publish ? "publish" : "dry-run",
    status: options.status ?? (options.publish ? "planned" : "dry_run_passed"),
    batchCount: options.batchCount ?? (summary.candidates.length > 0 ? 1 : 0),
    createdBy: options.createdBy || "marketing-microservice",
  });
}

async function maybeRecordOrderAffinityBackfillLedger(
  entry: OrderAffinityRunLedgerEntry,
  options: CliOptions
): Promise<OrderAffinityRunLedgerRecordResult> {
  if (!options.recordLedger && process.env.ORDER_AFFINITY_RUN_LEDGER_ENABLED !== "true") {
    return { status: "disabled", runId: entry.runId, idempotencyKeyCount: entry.catalogIdempotencyKeys.length, reason: "ledger_disabled" };
  }
  return recordOrderAffinityRunLedger(entry);
}

function inferSourceOwner(options: { marketplaceUrl?: string; ordersUrl?: string; sourceOwner?: string }): string {
  if (options.sourceOwner) return options.sourceOwner;
  if (options.marketplaceUrl) return inferMarketplaceSourceOwner(options.marketplaceUrl);
  if (options.ordersUrl) return "orders-microservice";
  return "manual-file";
}

function inferMarketplaceSourceOwner(marketplaceUrl: string): string {
  const host = safeUrlHost(marketplaceUrl);
  if (host.includes("aukro")) return "aukro-service";
  if (host.includes("bazos")) return "bazos-service";
  if (host.includes("allegro")) return "allegro-service";
  return "allegro-service";
}

function safeUrlHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function inferChannel(summary: OrderAffinityBackfillSummary): string {
  const channels = Object.keys(summary.byChannel);
  return channels.length === 1 ? channels[0] : "mixed";
}

function extractEventEnvelope(record: unknown): unknown {
  if (record && typeof record === "object" && !Array.isArray(record)) {
    const source = record as Record<string, unknown>;
    if (source.payload && source.routingKey === ORDERS_ORDER_CREATED_V1) return source.payload;
    if (source.payload && source.eventType === ORDERS_ORDER_CREATED_V1) return source.payload;
    if (source.payload && source.type === undefined && typeof source.event_id === "string") return source.payload;
  }
  return record;
}

function toBackfillCandidate(pair: AggregatedPair, runId: string): CatalogProductRelationUpsertCandidate {
  const channels = Array.from(pair.channels).sort();
  const currencies = Array.from(pair.currencies).sort();
  return {
    sourceProductId: pair.sourceProductId,
    targetProductId: pair.targetProductId,
    relationType: "order_affinity",
    score: pair.score,
    confidence: confidenceForScore(pair.score),
    source: CATALOG_ORDER_AFFINITY_SOURCE,
    evidence: {
      sourceSystem: "marketing-microservice",
      sourceEventType: ORDERS_ORDER_CREATED_V1,
      candidateId: `orders.order.created.v1:historical:${runId}:${pair.sourceProductId}:${pair.targetProductId}`,
      ...(channels.length === 1 ? { channel: channels[0] } : {}),
      ...(currencies.length === 1 ? { currency: currencies[0] } : {}),
      productCount: pair.maxProductCount,
      reason: "single_order_copurchase"
    }
  };
}

function confidenceForScore(score: number): number {
  if (score >= 10) return 0.9;
  if (score >= 5) return 0.8;
  if (score >= 2) return 0.65;
  return 0.5;
}

function uniqueCatalogProductIds(productRefs: string[] | undefined): string[] {
  const ids = (productRefs || [])
    .map((ref) => String(ref || ""))
    .map((ref) => ref.startsWith("catalog:product:") ? ref.slice("catalog:product:".length) : ref)
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids)).sort();
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = { publish: false, pretty: false, recordLedger: false, replaceWindow: false, completeSnapshot: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--publish") options.publish = true;
    else if (arg === "--dry-run") options.publish = false;
    else if (arg === "--replace-window") options.replaceWindow = true;
    else if (arg === "--complete-snapshot") options.completeSnapshot = true;
    else if (arg === "--owner-retention-policy-ref") options.ownerRetentionPolicyRef = argv[++index];
    else if (arg.startsWith("--owner-retention-policy-ref=")) options.ownerRetentionPolicyRef = arg.slice("--owner-retention-policy-ref=".length);
    else if (arg === "--pretty") options.pretty = true;
    else if (arg === "--file") options.file = argv[++index];
    else if (arg.startsWith("--file=")) options.file = arg.slice("--file=".length);
    else if (arg === "--limit") options.limit = Number(argv[++index]);
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice("--limit=".length));
    else if (arg === "--run-id") options.runId = argv[++index];
    else if (arg.startsWith("--run-id=")) options.runId = arg.slice("--run-id=".length);
    else if (arg === "--orders-url") options.ordersUrl = argv[++index];
    else if (arg.startsWith("--orders-url=")) options.ordersUrl = arg.slice("--orders-url=".length);
    else if (arg === "--marketplace-url") options.marketplaceUrl = argv[++index];
    else if (arg.startsWith("--marketplace-url=")) options.marketplaceUrl = arg.slice("--marketplace-url=".length);
    else if (arg === "--source-owner") options.sourceOwner = argv[++index];
    else if (arg.startsWith("--source-owner=")) options.sourceOwner = arg.slice("--source-owner=".length);
    else if (arg === "--channel") options.channel = argv[++index];
    else if (arg.startsWith("--channel=")) options.channel = arg.slice("--channel=".length);
    else if (arg === "--cursor-before") options.cursorBefore = argv[++index];
    else if (arg.startsWith("--cursor-before=")) options.cursorBefore = arg.slice("--cursor-before=".length);
    else if (arg === "--cursor-after") options.cursorAfter = argv[++index];
    else if (arg.startsWith("--cursor-after=")) options.cursorAfter = arg.slice("--cursor-after=".length);
    else if (arg === "--created-by") options.createdBy = argv[++index];
    else if (arg.startsWith("--created-by=")) options.createdBy = arg.slice("--created-by=".length);
    else if (arg === "--schedule") options.schedule = argv[++index] as OrderAffinityScheduleCadence;
    else if (arg.startsWith("--schedule=")) options.schedule = arg.slice("--schedule=".length) as OrderAffinityScheduleCadence;
    else if (arg === "--schedule-at") options.scheduleAt = argv[++index];
    else if (arg.startsWith("--schedule-at=")) options.scheduleAt = arg.slice("--schedule-at=".length);
    else if (arg === "--lookback") options.lookback = Number(argv[++index]);
    else if (arg.startsWith("--lookback=")) options.lookback = Number(arg.slice("--lookback=".length));
    else if (arg === "--window-delay-minutes") options.windowDelayMinutes = Number(argv[++index]);
    else if (arg.startsWith("--window-delay-minutes=")) options.windowDelayMinutes = Number(arg.slice("--window-delay-minutes=".length));
    else if (arg === "--record-ledger") options.recordLedger = true;
    else if (arg === "--from") options.from = argv[++index];
    else if (arg.startsWith("--from=")) options.from = arg.slice("--from=".length);
    else if (arg === "--to") options.to = argv[++index];
    else if (arg.startsWith("--to=")) options.to = arg.slice("--to=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readInput(file: string | undefined): unknown[] {
  const content = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown[] }).rows)) {
    return (parsed as { rows: unknown[] }).rows;
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { data?: { events?: unknown[] } }).data?.events)) {
    return (parsed as { data: { events: unknown[] } }).data.events;
  }
  return [parsed];
}

async function readOrdersReplayInput(options: CliOptions): Promise<unknown[]> {
  if (options.marketplaceUrl) return readMarketplaceReplayInput(options);
  if (!options.ordersUrl) return readInput(options.file);
  const url = new URL("/api/orders/internal/order-affinity/replay-candidates", options.ordersUrl);
  if (options.limit) url.searchParams.set("limit", String(options.limit));
  if (options.channel) url.searchParams.set("channel", options.channel);
  if (options.from) url.searchParams.set("from", options.from);
  if (options.to) url.searchParams.set("to", options.to);
  const response = await axios.get(url.toString(), {
    timeout: positiveInteger(process.env.ORDER_AFFINITY_ORDERS_TIMEOUT_MS, 10000),
    headers: orderAffinityOrdersReplayHeaders()
  });
  const events = response.data?.data?.events;
  if (!response.data?.success || !Array.isArray(events)) {
    throw new Error("orders_replay_candidates_unavailable");
  }
  return events;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readMarketplaceReplayInput(options: CliOptions): Promise<unknown[]> {
  const sourceOwner = inferSourceOwner(options);
  const url = new URL(marketplaceReplayPath(sourceOwner), options.marketplaceUrl);
  if (options.limit) url.searchParams.set("limit", String(options.limit));
  if (options.from) url.searchParams.set("from", options.from);
  if (options.to) url.searchParams.set("to", options.to);
  const response = await axios.get(url.toString(), {
    timeout: positiveInteger(process.env.ORDER_AFFINITY_MARKETPLACE_TIMEOUT_MS, 10000),
    headers: orderAffinityMarketplaceReplayHeadersForSource(sourceOwner)
  });
  const events = response.data?.data?.events;
  if (!response.data?.success || !Array.isArray(events)) {
    throw new Error("marketplace_replay_candidates_unavailable");
  }
  return events;
}

export function marketplaceReplayPath(sourceOwner: string): string {
  if (sourceOwner === "aukro-service") return "/internal/aukro/order-affinity/replay-candidates";
  if (sourceOwner === "bazos-service") return "/internal/bazos/order-affinity/replay-candidates";
  return "/internal/allegro/order-affinity/replay-candidates";
}

export function orderAffinityMarketplaceReplayHeadersForSource(sourceOwner: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> | undefined {
  const token = (
    sourceOwner === "aukro-service"
      ? env.ORDER_AFFINITY_AUKRO_REPLAY_TOKEN || env.AUKRO_INTERNAL_SERVICE_TOKEN
      : sourceOwner === "bazos-service"
        ? env.ORDER_AFFINITY_BAZOS_REPLAY_TOKEN || env.BAZOS_INTERNAL_SERVICE_TOKEN
        : undefined
  ) || env.ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN || env.ALLEGRO_INTERNAL_SERVICE_TOKEN || env.INTERNAL_SERVICE_TOKEN || "";
  const cleanToken = token.trim();
  if (!cleanToken) return undefined;
  return {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": cleanToken.replace(/^Bearer\s+/i, "")
  };
}

export function orderAffinityMarketplaceReplayHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> | undefined {
  return orderAffinityMarketplaceReplayHeadersForSource("allegro-service", env);
}

export function orderAffinityOrdersReplayHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> | undefined {
  const token = (env.ORDERS_SERVICE_TOKEN || env.ORDERS_INTERNAL_SERVICE_TOKEN || "").trim();
  if (!token) return undefined;
  return {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": token.replace(/^Bearer\s+/i, "")
  };
}

function normalizeRunId(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_.:-]/g, "-").slice(0, 120);
  if (!normalized) return `orders-history-${new Date().toISOString().slice(0, 10)}`;
  return normalized;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] || 0) + 1;
}

function sortedRecord(record: Record<string, number>): Record<string, number> {
  return Object.keys(record).sort().reduce<Record<string, number>>((acc, key) => {
    acc[key] = record[key];
    return acc;
  }, {});
}

function publicLedgerSummary(entry: OrderAffinityRunLedgerEntry) {
  return {
    runId: entry.runId,
    sourceOwner: entry.sourceOwner,
    channel: entry.channel,
    windowStart: entry.windowStart,
    windowEnd: entry.windowEnd,
    cursorBefore: entry.cursorBefore,
    cursorAfter: entry.cursorAfter,
    mode: entry.mode,
    status: entry.status,
    inputRecords: entry.inputRecords,
    acceptedCreatedEvents: entry.acceptedCreatedEvents,
    rejectedRecords: entry.rejectedRecords,
    skippedEvents: entry.skippedEvents,
    aggregatePairs: entry.aggregatePairs,
    totalPairEvidence: entry.totalPairEvidence,
    batchCount: entry.batchCount,
    catalogIdempotencyKeys: entry.catalogIdempotencyKeys,
    byChannel: entry.byChannel,
    rejectionReasons: entry.rejectionReasons
  };
}

function publicSummary(summary: OrderAffinityBackfillSummary) {
  return {
    runId: summary.runId,
    inputRecords: summary.inputRecords,
    acceptedCreatedEvents: summary.acceptedCreatedEvents,
    rejectedRecords: summary.rejectedRecords,
    skippedEvents: summary.skippedEvents,
    aggregatePairs: summary.aggregatePairs,
    totalPairEvidence: summary.totalPairEvidence,
    byChannel: summary.byChannel,
    rejectionReasons: summary.rejectionReasons,
    candidates: summary.candidates.map((candidate) => ({
      sourceProductId: candidate.sourceProductId,
      targetProductId: candidate.targetProductId,
      score: candidate.score,
      confidence: candidate.confidence,
      source: candidate.source
    }))
  };
}

async function main() {
  const options: CliOptions = applyOrderAffinitySchedulePolicy(parseCliArgs(process.argv.slice(2)));
  assertScheduledPublishHasLedger(options);
  const records = await readOrdersReplayInput(options);
  const summary = buildOrderAffinityBackfill(records, options);
  const plannedLedgerEntry = buildOrderAffinityBackfillLedgerEntry(summary, options);
  const publishMode = chooseOrderAffinityCatalogPublishMode(summary, plannedLedgerEntry, {
    replaceWindow: options.replaceWindow,
    completeSnapshot: options.completeSnapshot,
    ownerRetentionPolicyRef: options.ownerRetentionPolicyRef,
  });
  const output: Record<string, unknown> = {
    mode: options.publish ? "publish" : "dry-run",
    summary: publicSummary(summary),
    ledger: publicLedgerSummary(plannedLedgerEntry),
    catalogPublishMode: publishMode
  };
  if (options.publish && publishMode.mode === "replace-window-blocked") {
    output.publish = blockedPublishResult(summary, plannedLedgerEntry.batchCount, publishMode.reason || "replace_window_blocked");
    console.log(JSON.stringify(output, null, options.pretty ? 2 : 0));
    return;
  }

  let ledgerRecord = await maybeRecordOrderAffinityBackfillLedger(plannedLedgerEntry, options);
  if (options.publish && (options.schedule || publishMode.mode === "replace-window") && ledgerRecord.status !== "recorded") {
    output.ledgerRecord = ledgerRecord;
    output.publish = blockedPublishResult(summary, plannedLedgerEntry.batchCount, "scheduled_publish_ledger_not_recorded");
    console.log(JSON.stringify(output, null, options.pretty ? 2 : 0));
    return;
  }

  const publishResult = options.publish ? await publishOrderAffinityBackfill(summary, plannedLedgerEntry, publishMode.mode === "replace-window" ? "replace-window" : "batch") : undefined;
  if (publishResult) {
    const finalLedgerEntry = buildOrderAffinityBackfillLedgerEntry(summary, {
      ...options,
      status: ledgerStatusFromPublishResult(publishResult),
      batchCount: publishResult.batchCount,
    });
    output.ledger = publicLedgerSummary(finalLedgerEntry);
    output.publish = publishResult;
    ledgerRecord = await maybeRecordOrderAffinityBackfillLedger(finalLedgerEntry, options);
  }
  output.ledgerRecord = ledgerRecord;
  console.log(JSON.stringify(output, null, options.pretty ? 2 : 0));
}

function assertScheduledPublishHasLedger(options: CliOptions): void {
  if (!options.schedule || !options.publish) return;
  if (options.recordLedger || process.env.ORDER_AFFINITY_RUN_LEDGER_ENABLED === "true") return;
  throw new Error("order_affinity_scheduled_publish_requires_ledger");
}

function ledgerStatusFromPublishResult(result: OrderAffinityCatalogPublishResult): OrderAffinityRunStatus {
  return result.status === "published" ? "published" : "failed";
}

function blockedPublishResult(summary: OrderAffinityBackfillSummary, batchCount: number, reason: string): OrderAffinityCatalogPublishResult {
  return {
    status: "failed",
    candidateCount: summary.candidates.length,
    batchCount,
    reason,
  };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : "order_affinity_backfill_failed" }));
    process.exit(1);
  });
}
