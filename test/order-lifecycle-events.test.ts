import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY,
  ORDER_RUN_ATTRIBUTION_BLOCKER,
  ORDER_STATUS_CHANGED_ROUTING_KEY_DECISION,
  ORDERS_ORDER_CREATED_V1,
  ORDERS_ORDER_UPDATED_V1,
  OrdersLifecycleAttributionAccumulator,
  CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT,
  CATALOG_ORDER_AFFINITY_SOURCE,
  buildOrderAffinityRelationCandidates,
  parseOrdersLifecycleEvent,
  REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1
} from "../src/order-lifecycle-events";
import {
  orderAffinityCatalogPublisherOptionsFromEnv,
  publishOrderAffinityCandidatesToCatalog
} from "../src/order-affinity-catalog-publisher";
import { ordersEventsConsumerOptionsFromEnv, processOrdersEventMessage } from "../src/orders-events-consumer";
import { InMemoryMarketingStore } from "../src/store";

process.env.NODE_ENV = "test";

function orderCreatedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: ORDERS_ORDER_CREATED_V1,
    eventVersion: 1,
    eventId: "00000000-0000-4000-8000-000000000001",
    occurredAt: "2026-06-13T08:00:00.000Z",
    source: "orders-microservice",
    payload: {
      orderId: "order-1001",
      channel: "flipflop"
    },
    ...overrides
  };
}

function orderUpdatedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: ORDERS_ORDER_UPDATED_V1,
    eventVersion: 1,
    eventId: "00000000-0000-4000-8000-000000000002",
    occurredAt: "2026-06-13T08:01:00.000Z",
    source: "orders-microservice",
    payload: {
      orderId: "order-1001",
      status: "processing",
      previousStatus: "confirmed"
    },
    ...overrides
  };
}

test("orders lifecycle accumulator handles created and current status update events idempotently", () => {
  const accumulator = new OrdersLifecycleAttributionAccumulator();

  const created = accumulator.process(orderCreatedEvent());
  const updated = accumulator.process(orderUpdatedEvent());
  const duplicate = accumulator.process(orderUpdatedEvent());

  assert.equal(created.accepted, true);
  assert.equal(created.duplicate, false);
  assert.equal(created.attributionStatus, "blocked_missing_order_marketing_refs");
  assert.equal(updated.accepted, true);
  assert.equal(updated.duplicate, false);
  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.duplicate, true);

  assert.deepEqual(updated.stats.totals, {
    acceptedEvents: 2,
    duplicateEvents: 0,
    rejectedEvents: 0,
    orderCreated: 1,
    orderStatusChanged: 1,
    unattributedOrderSignals: 2,
    campaignAttributionUpdates: 0
  });
  assert.equal(duplicate.stats.totals.duplicateEvents, 1);
  assert.deepEqual(updated.stats.byEventType, {
    [ORDERS_ORDER_CREATED_V1]: 1,
    [ORDERS_ORDER_UPDATED_V1]: 1
  });
  assert.deepEqual(updated.stats.byChannel, { flipflop: 1 });
  assert.deepEqual(updated.stats.byStatus, { processing: 1 });
  assert.deepEqual(updated.stats.orderRefs, ["orders:order:order-1001"]);
  assert.equal(updated.stats.bindings.orderStatusChanged, APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY);
  assert.ok(updated.stats.blockers.includes(ORDER_RUN_ATTRIBUTION_BLOCKER));
  assert.equal(updated.stats.blockers.some((blocker) => blocker.includes("campaign-level")), false);
  assert.equal(updated.stats.blockers.some((blocker) => blocker.includes("status_changed")), false);
  assert.equal(ORDER_STATUS_CHANGED_ROUTING_KEY_DECISION.includes(ORDERS_ORDER_UPDATED_V1), true);
});

test("unapproved orders.order.status_changed.v1 alias is rejected while updated.v1 is the binding", () => {
  const accumulator = new OrdersLifecycleAttributionAccumulator();
  const result = accumulator.process({
    ...orderUpdatedEvent(),
    type: REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1,
    eventId: "00000000-0000-4000-8000-000000000003"
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, `unsupported_order_event_type:${REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1}`);
  assert.equal(result.blocker, undefined);
  assert.equal(result.stats.totals.rejectedEvents, 1);
  assert.equal(result.stats.bindings.orderStatusChanged, ORDERS_ORDER_UPDATED_V1);
});

test("order affinity relation candidates are deterministic and bounded", () => {
  const parsed = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      items: [
        { productId: "catalog-product-2002", quantity: 2 },
        { productId: "catalog-product-1001", quantity: 1 },
        { productId: "catalog-product-1001", quantity: 1 }
      ],
      currency: "CZK"
    }
  }));

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const candidates = buildOrderAffinityRelationCandidates(parsed.signal);

  assert.equal(CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT, "/api/internal/product-relations/order-affinity/batch");
  assert.equal(CATALOG_ORDER_AFFINITY_SOURCE, "marketing_order_affinity");

  assert.deepEqual(candidates.map((candidate) => [candidate.sourceProductId, candidate.targetProductId]), [
    ["catalog-product-1001", "catalog-product-2002"],
    ["catalog-product-2002", "catalog-product-1001"]
  ]);
  assert.deepEqual(candidates.map((candidate) => ({
    relationType: candidate.relationType,
    score: candidate.score,
    confidence: candidate.confidence,
    source: candidate.source,
    evidence: candidate.evidence
  })), [
    {
      relationType: "order_affinity",
      score: 1,
      confidence: 0.5,
      source: CATALOG_ORDER_AFFINITY_SOURCE,
      evidence: {
        sourceSystem: "marketing-microservice",
        sourceEventType: ORDERS_ORDER_CREATED_V1,
        candidateId: "orders.order.created.v1:00000000-0000-4000-8000-000000000001:catalog-product-1001:catalog-product-2002",
        channel: "flipflop",
        currency: "CZK",
        productCount: 2,
        reason: "single_order_copurchase"
      }
    },
    {
      relationType: "order_affinity",
      score: 1,
      confidence: 0.5,
      source: CATALOG_ORDER_AFFINITY_SOURCE,
      evidence: {
        sourceSystem: "marketing-microservice",
        sourceEventType: ORDERS_ORDER_CREATED_V1,
        candidateId: "orders.order.created.v1:00000000-0000-4000-8000-000000000001:catalog-product-2002:catalog-product-1001",
        channel: "flipflop",
        currency: "CZK",
        productCount: 2,
        reason: "single_order_copurchase"
      }
    }
  ]);
});

test("order affinity relation candidates require at least two products", () => {
  const created = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      items: [{ productId: "catalog-product-1001", quantity: 1 }]
    }
  }));
  const updated = parseOrdersLifecycleEvent(orderUpdatedEvent());

  assert.equal(created.ok, true);
  assert.equal(updated.ok, true);
  if (created.ok) assert.deepEqual(buildOrderAffinityRelationCandidates(created.signal), []);
  if (updated.ok) assert.deepEqual(buildOrderAffinityRelationCandidates(updated.signal), []);
});

test("order affinity catalog publisher stays safe when disabled or missing config", async () => {
  const parsed = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      items: [
        { productId: "catalog-product-1001", quantity: 1 },
        { productId: "catalog-product-2002", quantity: 1 }
      ]
    }
  }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const candidates = buildOrderAffinityRelationCandidates(parsed.signal);
  const disabled = await publishOrderAffinityCandidatesToCatalog(parsed.signal, candidates, {
    enabled: false,
    endpoint: CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT,
    timeoutMs: 5000,
    batchSize: 50
  });
  const missingConfig = await publishOrderAffinityCandidatesToCatalog(parsed.signal, candidates, {
    enabled: true,
    endpoint: CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT,
    timeoutMs: 5000,
    batchSize: 50
  });

  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.candidateCount, 2);
  assert.equal(missingConfig.status, "skipped_missing_config");
  assert.equal(missingConfig.candidateCount, 2);
});

test("order affinity catalog publisher posts bounded batch payload with service auth", async () => {
  const parsed = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      items: [
        { productId: "catalog-product-1001", quantity: 1 },
        { productId: "catalog-product-2002", quantity: 1 }
      ],
      currency: "CZK"
    }
  }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const calls: Array<{ url: string; payload: any; config: { timeout: number; headers: Record<string, string> } }> = [];
  const candidates = buildOrderAffinityRelationCandidates(parsed.signal);
  const result = await publishOrderAffinityCandidatesToCatalog(parsed.signal, candidates, {
    enabled: true,
    catalogServiceUrl: "http://catalog-microservice:3200/",
    internalServiceToken: "catalog-write-token",
    endpoint: CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT,
    timeoutMs: 1234,
    batchSize: 50
  }, async (url, payload, config) => {
    calls.push({ url, payload, config });
  });

  assert.equal(result.status, "published");
  assert.equal(result.candidateCount, 2);
  assert.equal(result.batchCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://catalog-microservice:3200/api/internal/product-relations/order-affinity/batch");
  assert.equal(calls[0].config.timeout, 1234);
  assert.equal(calls[0].config.headers["x-internal-service-token"], "catalog-write-token");
  assert.equal(calls[0].config.headers["x-service-name"], "marketing-microservice");
  assert.equal(calls[0].payload.source, CATALOG_ORDER_AFFINITY_SOURCE);
  assert.equal(calls[0].payload.idempotencyKey, "marketing_order_affinity:00000000-0000-4000-8000-000000000001:1");
  assert.equal(calls[0].payload.items.length, 2);
  assert.deepEqual(Object.keys(calls[0].payload.items[0]).sort(), [
    "confidence",
    "evidence",
    "score",
    "sourceProductId",
    "targetProductId"
  ]);
});

test("order affinity catalog publisher env config is explicit and disabled by default", () => {
  const defaults = orderAffinityCatalogPublisherOptionsFromEnv({});
  const configured = orderAffinityCatalogPublisherOptionsFromEnv({
    ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED: "true",
    CATALOG_SERVICE_URL: "http://catalog-microservice:3200",
    CATALOG_INTERNAL_SERVICE_TOKEN: "catalog-write-token",
    CATALOG_ORDER_AFFINITY_TIMEOUT_MS: "1234",
    CATALOG_ORDER_AFFINITY_BATCH_SIZE: "7"
  });

  assert.equal(defaults.enabled, false);
  assert.equal(defaults.endpoint, CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT);
  assert.equal(configured.enabled, true);
  assert.equal(configured.catalogServiceUrl, "http://catalog-microservice:3200");
  assert.equal(configured.internalServiceToken, "catalog-write-token");
  assert.equal(configured.timeoutMs, 1234);
  assert.equal(configured.batchSize, 7);
});

test("order lifecycle parser accepts bounded product item refs from Orders created events", () => {
  const parsed = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      items: [
        { productId: "catalog-product-1001", sku: "SKU-1001", quantity: 1, unitPrice: 490, totalPrice: 490 },
        { productId: "catalog-product-2002", sku: "SKU-2002", quantity: 2, unitPrice: 150, totalPrice: 300 }
      ],
      currency: "CZK"
    }
  }));

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.signal.productRefs, [
      "catalog:product:catalog-product-1001",
      "catalog:product:catalog-product-2002"
    ]);
    assert.equal(parsed.signal.currency, "CZK");
  }
});

test("order lifecycle parser rejects unsafe product item fields", () => {
  const parsed = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      items: [
        { productId: "catalog-product-1001", quantity: 1, productTitle: "must-not-copy-product-truth" }
      ]
    }
  }));

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.reason, "order_event_items_invalid");
  }
});

test("order lifecycle parser rejects sensitive or non-contract payload fields", () => {
  const parsed = parseOrdersLifecycleEvent(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      customerEmail: "buyer@example.com"
    }
  }));

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.reason, "order_event_forbidden_field:payload.customerEmail");
  }
});

test("order lifecycle parser accepts safe approval metadata on status updates", () => {
  const parsed = parseOrdersLifecycleEvent(orderUpdatedEvent({
    payload: {
      orderId: "order-1001",
      status: "cancelled",
      previousStatus: "confirmed",
      approval: {
        approvalType: "human",
        reasonCode: "owner_requested",
        sideEffectsHandled: { warehouseRelease: true },
        approvedAt: "2026-06-13T08:02:00.000Z"
      }
    }
  }));

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.signal.status, "cancelled");
  }
});

test("orders lifecycle attribution uses explicit leadAttribution campaignId join key", () => {
  const accumulator = new OrdersLifecycleAttributionAccumulator();

  const created = accumulator.process(orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      leadAttribution: {
        leadId: "lead-1001",
        source: "flipflop-checkout",
        campaignId: "campaign-1001"
      }
    }
  }));
  const updated = accumulator.process(orderUpdatedEvent());

  assert.equal(created.attributionStatus, "attributed_campaign");
  assert.equal(updated.attributionStatus, "attributed_campaign");
  assert.equal(updated.event?.campaignId, "campaign-1001");
  assert.equal(updated.stats.totals.unattributedOrderSignals, 0);
  assert.equal(updated.stats.totals.campaignAttributionUpdates, 2);
  assert.deepEqual(updated.stats.byCampaignId, { "campaign-1001": 2 });
  assert.deepEqual(updated.stats.campaignRefs, ["marketing:campaign:campaign-1001"]);
});

test("orders event message processing persists accepted events and deduplicates replays", async () => {
  const store = new InMemoryMarketingStore();
  await store.reset();

  const attributedCreated = orderCreatedEvent({
    payload: {
      orderId: "order-1001",
      channel: "flipflop",
      leadAttribution: {
        campaignId: "campaign-1001"
      }
    }
  });
  const first = await processOrdersEventMessage(JSON.stringify(attributedCreated), store, "2026-07-01T10:00:00.000Z");
  const replay = await processOrdersEventMessage(JSON.stringify(attributedCreated), store, "2026-07-01T10:01:00.000Z");
  const stats = await store.getOrdersLifecycleStats();

  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);
  assert.equal(replay.accepted, false);
  assert.equal(replay.duplicate, true);
  assert.equal(stats.totals.acceptedEvents, 1);
  assert.equal(stats.totals.orderCreated, 1);
  assert.equal(stats.totals.campaignAttributionUpdates, 1);
  assert.deepEqual(stats.orderRefs, ["orders:order:order-1001"]);
  assert.deepEqual(stats.campaignRefs, ["marketing:campaign:campaign-1001"]);
  assert.deepEqual(stats.byCampaignId, { "campaign-1001": 1 });
});

test("orders event consumer config binds created and approved updated routing keys", () => {
  const config = ordersEventsConsumerOptionsFromEnv({
    ORDERS_EVENTS_CONSUMER_ENABLED: "true",
    RABBITMQ_URL: "amqp://example.invalid",
    ORDERS_EVENTS_QUEUE: "marketing.orders.lifecycle",
    ORDERS_EVENTS_PREFETCH: "5"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.queue, "marketing.orders.lifecycle");
  assert.equal(config.prefetch, 5);
  assert.deepEqual(config.routingKeys, [ORDERS_ORDER_CREATED_V1, ORDERS_ORDER_UPDATED_V1]);
  assert.equal(config.routingKeys.includes(REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1), false);
});
