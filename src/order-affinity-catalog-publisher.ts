import axios from "axios";
import {
  CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT,
  CATALOG_ORDER_AFFINITY_SOURCE,
  CatalogProductRelationUpsertCandidate,
  OrdersLifecycleSignal,
  buildOrderAffinityRelationCandidates
} from "./order-lifecycle-events";

export type CatalogPost = (url: string, payload: unknown, config: { timeout: number; headers: Record<string, string> }) => Promise<unknown>;

export interface OrderAffinityCatalogPublisherOptions {
  enabled: boolean;
  catalogServiceUrl?: string;
  internalServiceToken?: string;
  endpoint: string;
  replaceWindowEndpoint: string;
  timeoutMs: number;
  batchSize: number;
}

export interface OrderAffinityCatalogPublishContext {
  idempotencyKeys?: string[];
  replaceWindow?: {
    sourceOwner: string;
    channel: string;
    windowStart: string;
    windowEnd: string;
    runId: string;
  };
}

export interface OrderAffinityCatalogPublishResult {
  status: "disabled" | "skipped_no_candidates" | "skipped_missing_config" | "published" | "failed";
  candidateCount: number;
  batchCount: number;
  endpoint?: string;
  reason?: string;
}

export function orderAffinityCatalogPublisherOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): OrderAffinityCatalogPublisherOptions {
  return {
    enabled: env.ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED === "true",
    catalogServiceUrl: env.CATALOG_SERVICE_URL,
    internalServiceToken: env.CATALOG_INTERNAL_SERVICE_TOKEN,
    endpoint: env.CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT || CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT,
    replaceWindowEndpoint: env.CATALOG_ORDER_AFFINITY_REPLACE_WINDOW_ENDPOINT || "/api/internal/product-relations/order-affinity/replace-window",
    timeoutMs: positiveInteger(env.CATALOG_ORDER_AFFINITY_TIMEOUT_MS, 5000),
    batchSize: positiveInteger(env.CATALOG_ORDER_AFFINITY_BATCH_SIZE, 50)
  };
}

export async function publishOrderAffinitySignalToCatalog(
  signal: OrdersLifecycleSignal,
  options: OrderAffinityCatalogPublisherOptions = orderAffinityCatalogPublisherOptionsFromEnv(),
  post: CatalogPost = axios.post,
  context: OrderAffinityCatalogPublishContext = {}
): Promise<OrderAffinityCatalogPublishResult> {
  const candidates = buildOrderAffinityRelationCandidates(signal);
  return publishOrderAffinityCandidatesToCatalog(signal, candidates, options, post, context);
}

export async function publishOrderAffinityCandidatesToCatalog(
  signal: OrdersLifecycleSignal,
  candidates: CatalogProductRelationUpsertCandidate[],
  options: OrderAffinityCatalogPublisherOptions = orderAffinityCatalogPublisherOptionsFromEnv(),
  post: CatalogPost = axios.post,
  context: OrderAffinityCatalogPublishContext = {}
): Promise<OrderAffinityCatalogPublishResult> {
  if (!options.enabled) {
    return { status: "disabled", candidateCount: candidates.length, batchCount: 0, reason: "publisher_disabled" };
  }
  if (candidates.length === 0) {
    return { status: "skipped_no_candidates", candidateCount: 0, batchCount: 0, reason: "no_order_affinity_candidates" };
  }
  if (!options.catalogServiceUrl || !options.internalServiceToken) {
    return { status: "skipped_missing_config", candidateCount: candidates.length, batchCount: 0, reason: "catalog_url_or_internal_token_missing" };
  }

  const endpoint = joinUrl(options.catalogServiceUrl, context.replaceWindow ? options.replaceWindowEndpoint : options.endpoint);
  const batches = context.replaceWindow ? [candidates] : chunk(candidates, options.batchSize);
  try {
    for (let index = 0; index < batches.length; index += 1) {
      const idempotencyKey = context.idempotencyKeys?.[index] || `marketing_order_affinity:${signal.eventId}:${index + 1}`;
      await post(endpoint, {
        source: CATALOG_ORDER_AFFINITY_SOURCE,
        idempotencyKey,
        generatedAt: new Date().toISOString(),
        ...(context.replaceWindow ? {
          sourceOwner: context.replaceWindow.sourceOwner,
          channel: context.replaceWindow.channel,
          windowStart: context.replaceWindow.windowStart,
          windowEnd: context.replaceWindow.windowEnd,
          runId: context.replaceWindow.runId,
          completeSnapshot: true
        } : {}),
        items: batches[index].map((candidate) => ({
          sourceProductId: candidate.sourceProductId,
          targetProductId: candidate.targetProductId,
          score: candidate.score,
          confidence: candidate.confidence,
          evidence: candidate.evidence
        }))
      }, {
        timeout: options.timeoutMs,
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": options.internalServiceToken,
          "x-service-name": "marketing-microservice"
        }
      });
    }
    return { status: "published", candidateCount: candidates.length, batchCount: batches.length, endpoint };
  } catch (error) {
    return {
      status: "failed",
      candidateCount: candidates.length,
      batchCount: batches.length,
      endpoint,
      reason: error instanceof Error ? error.message : "catalog_publish_failed"
    };
  }
}

function joinUrl(baseUrl: string, endpoint: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  const safeSize = Math.max(1, size);
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
