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
  orderAffinityCatalogPublisherOptionsFromEnv,
  publishOrderAffinityCandidatesToCatalog
} from "./order-affinity-catalog-publisher";

export interface OrderAffinityBackfillOptions {
  limit?: number;
  runId?: string;
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
  channel?: string;
  from?: string;
  to?: string;
  publish: boolean;
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

export async function publishOrderAffinityBackfill(summary: OrderAffinityBackfillSummary) {
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
    orderAffinityCatalogPublisherOptionsFromEnv()
  );
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
  const options: CliOptions = { publish: false, pretty: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--publish") options.publish = true;
    else if (arg === "--dry-run") options.publish = false;
    else if (arg === "--pretty") options.pretty = true;
    else if (arg === "--file") options.file = argv[++index];
    else if (arg.startsWith("--file=")) options.file = arg.slice("--file=".length);
    else if (arg === "--limit") options.limit = Number(argv[++index]);
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice("--limit=".length));
    else if (arg === "--run-id") options.runId = argv[++index];
    else if (arg.startsWith("--run-id=")) options.runId = arg.slice("--run-id=".length);
    else if (arg === "--orders-url") options.ordersUrl = argv[++index];
    else if (arg.startsWith("--orders-url=")) options.ordersUrl = arg.slice("--orders-url=".length);
    else if (arg === "--channel") options.channel = argv[++index];
    else if (arg.startsWith("--channel=")) options.channel = arg.slice("--channel=".length);
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
  return [parsed];
}

async function readOrdersReplayInput(options: CliOptions): Promise<unknown[]> {
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
  const options = parseCliArgs(process.argv.slice(2));
  const records = await readOrdersReplayInput(options);
  const summary = buildOrderAffinityBackfill(records, options);
  const output: Record<string, unknown> = {
    mode: options.publish ? "publish" : "dry-run",
    summary: publicSummary(summary)
  };
  if (options.publish) {
    output.publish = await publishOrderAffinityBackfill(summary);
  }
  console.log(JSON.stringify(output, null, options.pretty ? 2 : 0));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : "order_affinity_backfill_failed" }));
    process.exit(1);
  });
}
