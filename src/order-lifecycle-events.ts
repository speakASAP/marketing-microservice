export const ORDERS_EVENTS_EXCHANGE = "orders.events";
export const ORDERS_ORDER_CREATED_V1 = "orders.order.created.v1";
export const MARKETPLACE_ORDER_AFFINITY_CANDIDATE_V1 = "marketplace.order_affinity_candidate.v1";
export const ORDERS_ORDER_UPDATED_V1 = "orders.order.updated.v1";
export const REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1 = "orders.order.status_changed.v1";
export const APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY = ORDERS_ORDER_UPDATED_V1;

export const ORDER_STATUS_CHANGED_ROUTING_KEY_DECISION =
  "Marketing binds orders.order.updated.v1 as the approved canonical Orders status-change event for the current producer contract.";

export const ORDER_RUN_ATTRIBUTION_BLOCKER =
  "[MISSING: Orders event payload runId/correlationId or approved attribution join contract for run-level attribution]";

export type SupportedOrdersLifecycleEventType = typeof ORDERS_ORDER_CREATED_V1 | typeof ORDERS_ORDER_UPDATED_V1;

export interface OrdersLifecycleEventEnvelope {
  type: SupportedOrdersLifecycleEventType;
  eventVersion: 1;
  eventId: string;
  occurredAt: string;
  source: "orders-microservice";
  payload: Record<string, unknown>;
}

export type CatalogRelationType = "order_affinity";
export const CATALOG_ORDER_AFFINITY_SOURCE = "marketing_order_affinity";
export const CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT = "/api/internal/product-relations/order-affinity/batch";
export type CatalogRelationSource = typeof CATALOG_ORDER_AFFINITY_SOURCE;

export interface CatalogProductRelationUpsertCandidate {
  sourceProductId: string;
  targetProductId: string;
  relationType: CatalogRelationType;
  score: number;
  confidence: number;
  source: CatalogRelationSource;
  evidence: {
    sourceSystem: "marketing-microservice";
    sourceEventType: typeof ORDERS_ORDER_CREATED_V1;
    candidateId: string;
    channel?: string;
    currency?: string;
    productCount: number;
    reason: "single_order_copurchase";
  };
}

export interface OrdersLifecycleSignal {
  eventType: SupportedOrdersLifecycleEventType;
  eventVersion: 1;
  eventId: string;
  occurredAt: string;
  orderId: string;
  channel?: string;
  status?: string;
  previousStatus?: string;
  campaignId?: string;
  productRefs?: string[];
  currency?: string;
}

export interface OrdersLifecycleStats {
  sourceOwner: "orders-microservice";
  consumerOwner: "marketing-microservice";
  exchange: typeof ORDERS_EVENTS_EXCHANGE;
  bindings: {
    orderCreated: typeof ORDERS_ORDER_CREATED_V1;
    orderStatusChanged: typeof APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY;
  };
  processedEventIds: string[];
  orderRefs: string[];
  totals: {
    acceptedEvents: number;
    duplicateEvents: number;
    rejectedEvents: number;
    orderCreated: number;
    orderStatusChanged: number;
    unattributedOrderSignals: number;
    campaignAttributionUpdates: number;
  };
  byEventType: Record<string, number>;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  byCampaignId: Record<string, number>;
  campaignRefs: string[];
  blockers: string[];
}

export interface OrdersLifecycleProcessingResult {
  accepted: boolean;
  duplicate: boolean;
  event?: OrdersLifecycleSignal;
  reason?: string;
  blocker?: string;
  attributionStatus: "not_applicable" | "blocked_missing_order_marketing_refs" | "attributed_campaign";
  stats: OrdersLifecycleStats;
}

interface MutableOrderState {
  orderId: string;
  firstSeenAt: string;
  lastEventAt: string;
  channel?: string;
  status?: string;
  previousStatus?: string;
  campaignId?: string;
}

interface ParsedEvent {
  ok: true;
  signal: OrdersLifecycleSignal;
}

interface RejectedEvent {
  ok: false;
  reason: string;
  blocker?: string;
}

const FORBIDDEN_FIELD_PATTERN =
  /(customer|address|billing|street|postal|paymentMethod|providerSecret|bearer|token|jwt|password|credential|trackingNumber|trackingUrl|operatorEmail|approverEmail|email|phone)/i;

const CREATED_PAYLOAD_FIELDS = new Set(["orderId", "channel", "leadAttribution", "items", "currency"]);
const MARKETPLACE_AFFINITY_PAYLOAD_FIELDS = new Set(["orderId", "channel", "items", "currency"]);
const MARKETPLACE_AFFINITY_SOURCES = new Set(["allegro-service", "aukro-service", "bazos-service"]);
const UPDATED_PAYLOAD_FIELDS = new Set(["orderId", "status", "previousStatus", "approval"]);
const APPROVAL_PAYLOAD_FIELDS = new Set(["approvalType", "reasonCode", "sideEffectsHandled", "approvedAt"]);
const LEAD_ATTRIBUTION_PAYLOAD_FIELDS = new Set(["leadId", "source", "campaignId"]);
const ORDER_ITEM_PAYLOAD_FIELDS = new Set(["productId", "sku", "quantity", "unitPrice", "totalPrice"]);

export function parseOrdersLifecycleEvent(input: unknown): ParsedEvent | RejectedEvent {
  if (!isObject(input)) return reject("invalid_order_event_envelope");

  const type = readString(input, "type");
  if (type === MARKETPLACE_ORDER_AFFINITY_CANDIDATE_V1) {
    return parseMarketplaceOrderAffinityCandidate(input, type);
  }

  if (type === REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1) {
    return reject(`unsupported_order_event_type:${REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1}`);
  }
  if (type !== ORDERS_ORDER_CREATED_V1 && type !== ORDERS_ORDER_UPDATED_V1) {
    return reject(`unsupported_order_event_type:${type || "missing"}`);
  }

  if (input.eventVersion !== 1) return reject("unsupported_order_event_version");
  const eventId = readString(input, "eventId");
  if (!eventId) return reject("order_event_id_missing");
  const occurredAt = readString(input, "occurredAt");
  if (!isIsoTimestamp(occurredAt)) return reject("order_event_occurred_at_invalid");
  if (readString(input, "source") !== "orders-microservice") return reject("order_event_source_invalid");
  if (!isObject(input.payload)) return reject("order_event_payload_invalid");
  const forbiddenPath = findForbiddenField(input.payload);
  if (forbiddenPath) return reject(`order_event_forbidden_field:${forbiddenPath}`);

  const allowedFields = type === ORDERS_ORDER_CREATED_V1 ? CREATED_PAYLOAD_FIELDS : UPDATED_PAYLOAD_FIELDS;
  for (const key of Object.keys(input.payload)) {
    if (!allowedFields.has(key)) return reject(`order_event_unexpected_payload_field:${key}`);
  }

  const orderId = readString(input.payload, "orderId");
  if (!orderId) return reject("order_event_order_id_missing");

  if (type === ORDERS_ORDER_CREATED_V1) {
    const channel = readString(input.payload, "channel");
    if (!channel) return reject("order_created_channel_missing");
    const campaignId = readCampaignAttributionId(input.payload.leadAttribution);
    if (campaignId === null) return reject("order_event_lead_attribution_invalid");
    const productRefs = readProductRefs(input.payload.items);
    if (productRefs === null) return reject("order_event_items_invalid");
    const currency = readOptionalCurrency(input.payload.currency);
    if (currency === null) return reject("order_event_currency_invalid");
    return {
      ok: true,
      signal: {
        eventType: type,
        eventVersion: 1,
        eventId,
        occurredAt,
        orderId,
        channel,
        campaignId: campaignId || undefined,
        productRefs,
        currency
      }
    };
  }

  const status = readString(input.payload, "status");
  if (!status) return reject("order_status_missing");
  const previousStatus = readString(input.payload, "previousStatus") || undefined;
  const approval = input.payload.approval;
  if (approval !== undefined && !isSafeApprovalObject(approval)) return reject("order_event_approval_invalid");

  return {
    ok: true,
    signal: { eventType: type, eventVersion: 1, eventId, occurredAt, orderId, status, previousStatus }
  };
}

function parseMarketplaceOrderAffinityCandidate(input: Record<string, unknown>, type: string): ParsedEvent | RejectedEvent {
  if (input.eventVersion !== 1) return reject("unsupported_marketplace_affinity_event_version");
  const eventId = readString(input, "eventId");
  if (!eventId) return reject("marketplace_affinity_event_id_missing");
  const occurredAt = readString(input, "occurredAt");
  if (!isIsoTimestamp(occurredAt)) return reject("marketplace_affinity_occurred_at_invalid");
  const source = readString(input, "source");
  if (!MARKETPLACE_AFFINITY_SOURCES.has(source)) return reject(`marketplace_affinity_source_invalid:${source || "missing"}`);
  if (!isObject(input.payload)) return reject("marketplace_affinity_payload_invalid");
  const forbiddenPath = findForbiddenField(input.payload);
  if (forbiddenPath) return reject(`order_event_forbidden_field:${forbiddenPath}`);
  for (const key of Object.keys(input.payload)) {
    if (!MARKETPLACE_AFFINITY_PAYLOAD_FIELDS.has(key)) return reject(`marketplace_affinity_unexpected_payload_field:${key}`);
  }
  const orderId = readString(input.payload, "orderId");
  if (!orderId) return reject("marketplace_affinity_order_id_missing");
  const channel = readString(input.payload, "channel");
  if (!channel) return reject("marketplace_affinity_channel_missing");
  const productRefs = readProductRefs(input.payload.items);
  if (productRefs === null) return reject("marketplace_affinity_items_invalid");
  const currency = readOptionalCurrency(input.payload.currency);
  if (currency === null) return reject("marketplace_affinity_currency_invalid");
  return {
    ok: true,
    signal: {
      eventType: ORDERS_ORDER_CREATED_V1,
      eventVersion: 1,
      eventId: `${type}:${eventId}`,
      occurredAt,
      orderId,
      channel,
      productRefs,
      currency
    }
  };
}

export function buildOrderAffinityRelationCandidates(signal: OrdersLifecycleSignal): CatalogProductRelationUpsertCandidate[] {
  if (signal.eventType !== ORDERS_ORDER_CREATED_V1) return [];
  const productIds = uniqueCatalogProductIds(signal.productRefs);
  if (productIds.length < 2) return [];

  const candidates: CatalogProductRelationUpsertCandidate[] = [];
  for (const sourceProductId of productIds) {
    for (const targetProductId of productIds) {
      if (sourceProductId === targetProductId) continue;
      candidates.push({
        sourceProductId,
        targetProductId,
        relationType: "order_affinity",
        score: 1,
        confidence: 0.5,
        source: CATALOG_ORDER_AFFINITY_SOURCE,
        evidence: {
          sourceSystem: "marketing-microservice",
          sourceEventType: ORDERS_ORDER_CREATED_V1,
          candidateId: `${ORDERS_ORDER_CREATED_V1}:${signal.eventId}:${sourceProductId}:${targetProductId}`,
          ...(signal.channel ? { channel: signal.channel } : {}),
          ...(signal.currency ? { currency: signal.currency } : {}),
          productCount: productIds.length,
          reason: "single_order_copurchase"
        }
      });
    }
  }
  return candidates;
}

export class OrdersLifecycleAttributionAccumulator {
  private readonly processedEventIds = new Set<string>();
  private readonly orderStates = new Map<string, MutableOrderState>();
  private readonly totals: OrdersLifecycleStats["totals"] = {
    acceptedEvents: 0,
    duplicateEvents: 0,
    rejectedEvents: 0,
    orderCreated: 0,
    orderStatusChanged: 0,
    unattributedOrderSignals: 0,
    campaignAttributionUpdates: 0
  };
  private readonly byEventType: Record<string, number> = {};
  private readonly byChannel: Record<string, number> = {};
  private readonly byStatus: Record<string, number> = {};
  private readonly byCampaignId: Record<string, number> = {};

  process(input: unknown): OrdersLifecycleProcessingResult {
    const parsed = parseOrdersLifecycleEvent(input);
    if (!parsed.ok) {
      this.totals.rejectedEvents += 1;
      return {
        accepted: false,
        duplicate: false,
        reason: parsed.reason,
        blocker: parsed.blocker,
        attributionStatus: "not_applicable",
        stats: this.snapshot()
      };
    }

    const signal = parsed.signal;
    if (this.processedEventIds.has(signal.eventId)) {
      this.totals.duplicateEvents += 1;
      const campaignId = signal.campaignId ?? this.orderStates.get(signal.orderId)?.campaignId;
      return {
        accepted: true,
        duplicate: true,
        event: campaignId && !signal.campaignId ? { ...signal, campaignId } : signal,
        attributionStatus: campaignId ? "attributed_campaign" : "blocked_missing_order_marketing_refs",
        stats: this.snapshot()
      };
    }

    this.processedEventIds.add(signal.eventId);
    this.totals.acceptedEvents += 1;
    increment(this.byEventType, signal.eventType);

    const existing = this.orderStates.get(signal.orderId);
    const campaignId = signal.campaignId ?? existing?.campaignId;
    if (campaignId) {
      this.totals.campaignAttributionUpdates += 1;
      increment(this.byCampaignId, campaignId);
    } else {
      this.totals.unattributedOrderSignals += 1;
    }
    const nextState: MutableOrderState = {
      orderId: signal.orderId,
      firstSeenAt: existing?.firstSeenAt ?? signal.occurredAt,
      lastEventAt: signal.occurredAt,
      channel: signal.channel ?? existing?.channel,
      status: signal.status ?? existing?.status,
      previousStatus: signal.previousStatus ?? existing?.previousStatus,
      campaignId
    };
    this.orderStates.set(signal.orderId, nextState);

    if (signal.eventType === ORDERS_ORDER_CREATED_V1) {
      this.totals.orderCreated += 1;
      if (signal.channel) increment(this.byChannel, signal.channel);
    } else {
      this.totals.orderStatusChanged += 1;
      if (signal.status) increment(this.byStatus, signal.status);
    }

    return {
      accepted: true,
      duplicate: false,
      event: campaignId && !signal.campaignId ? { ...signal, campaignId } : signal,
      attributionStatus: campaignId ? "attributed_campaign" : "blocked_missing_order_marketing_refs",
      stats: this.snapshot()
    };
  }

  snapshot(): OrdersLifecycleStats {
    return {
      sourceOwner: "orders-microservice",
      consumerOwner: "marketing-microservice",
      exchange: ORDERS_EVENTS_EXCHANGE,
      bindings: {
        orderCreated: ORDERS_ORDER_CREATED_V1,
        orderStatusChanged: APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY
      },
      processedEventIds: Array.from(this.processedEventIds).sort(),
      orderRefs: Array.from(this.orderStates.keys()).map((orderId) => `orders:order:${orderId}`).sort(),
      totals: { ...this.totals },
      byEventType: sortedRecord(this.byEventType),
      byChannel: sortedRecord(this.byChannel),
      byStatus: sortedRecord(this.byStatus),
      byCampaignId: sortedRecord(this.byCampaignId),
      campaignRefs: Array.from(new Set(Array.from(this.orderStates.values()).map((state) => state.campaignId).filter(Boolean) as string[]))
        .map((campaignId) => `marketing:campaign:${campaignId}`)
        .sort(),
      blockers: [ORDER_RUN_ATTRIBUTION_BLOCKER]
    };
  }
}

function reject(reason: string, blocker?: string): RejectedEvent {
  return { ok: false, reason, blocker };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function isIsoTimestamp(value: string): boolean {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function sortedRecord(record: Record<string, number>): Record<string, number> {
  return Object.keys(record)
    .sort()
    .reduce<Record<string, number>>((accumulator, key) => {
      accumulator[key] = record[key];
      return accumulator;
    }, {});
}

function findForbiddenField(value: unknown, path = "payload"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenField(value[index], `${path}.${index}`);
      if (found) return found;
    }
    return null;
  }

  if (!isObject(value)) return null;

  for (const [key, nested] of Object.entries(value)) {
    const currentPath = `${path}.${key}`;
    if (FORBIDDEN_FIELD_PATTERN.test(key)) return currentPath;
    const found = findForbiddenField(nested, currentPath);
    if (found) return found;
  }
  return null;
}

function readCampaignAttributionId(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value)) return null;
  for (const key of Object.keys(value)) {
    if (!LEAD_ATTRIBUTION_PAYLOAD_FIELDS.has(key)) return null;
  }
  const campaignId = readString(value, "campaignId");
  return campaignId || undefined;
}

function readProductRefs(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const refs: string[] = [];
  for (const item of value) {
    if (!isObject(item)) return null;
    for (const key of Object.keys(item)) {
      if (!ORDER_ITEM_PAYLOAD_FIELDS.has(key)) return null;
    }
    const productId = readString(item, "productId");
    if (!productId) return null;
    const quantity = item.quantity;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return null;
    if (item.sku !== undefined && typeof item.sku !== "string") return null;
    if (item.unitPrice !== undefined && (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice))) return null;
    if (item.totalPrice !== undefined && (typeof item.totalPrice !== "number" || !Number.isFinite(item.totalPrice))) return null;
    refs.push(`catalog:product:${productId}`);
  }
  return Array.from(new Set(refs)).sort();
}

function uniqueCatalogProductIds(productRefs: string[] | undefined): string[] {
  if (!Array.isArray(productRefs)) return [];
  return Array.from(new Set(productRefs.map((ref) => {
    const prefix = "catalog:product:";
    return ref.startsWith(prefix) ? ref.slice(prefix.length).trim() : "";
  }).filter(Boolean))).sort();
}

function readOptionalCurrency(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  return /^[A-Z]{3}$/.test(value) ? value : null;
}

function isSafeApprovalObject(value: unknown): boolean {
  if (!isObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (!APPROVAL_PAYLOAD_FIELDS.has(key)) return false;
  }
  if (value.approvalType !== undefined && value.approvalType !== "human") return false;
  if (value.reasonCode !== undefined && typeof value.reasonCode !== "string") return false;
  if (value.approvedAt !== undefined && !isIsoTimestamp(String(value.approvedAt))) return false;
  if (value.sideEffectsHandled !== undefined && !isTrueRecord(value.sideEffectsHandled)) return false;
  return true;
}

function isTrueRecord(value: unknown): boolean {
  if (!isObject(value)) return false;
  return Object.values(value).every((entry) => entry === true);
}
