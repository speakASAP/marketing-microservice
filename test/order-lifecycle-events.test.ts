import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY,
  ORDER_CAMPAIGN_ATTRIBUTION_BLOCKER,
  ORDER_STATUS_CHANGED_ROUTING_KEY_DECISION,
  ORDERS_ORDER_CREATED_V1,
  ORDERS_ORDER_UPDATED_V1,
  OrdersLifecycleAttributionAccumulator,
  parseOrdersLifecycleEvent,
  REQUESTED_ORDERS_ORDER_STATUS_CHANGED_V1
} from "../src/order-lifecycle-events";
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
  assert.ok(updated.stats.blockers.includes(ORDER_CAMPAIGN_ATTRIBUTION_BLOCKER));
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

test("orders event message processing persists accepted events and deduplicates replays", async () => {
  const store = new InMemoryMarketingStore();
  await store.reset();

  const first = await processOrdersEventMessage(JSON.stringify(orderCreatedEvent()), store, "2026-07-01T10:00:00.000Z");
  const replay = await processOrdersEventMessage(JSON.stringify(orderCreatedEvent()), store, "2026-07-01T10:01:00.000Z");
  const stats = await store.getOrdersLifecycleStats();

  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);
  assert.equal(replay.accepted, false);
  assert.equal(replay.duplicate, true);
  assert.equal(stats.totals.acceptedEvents, 1);
  assert.equal(stats.totals.orderCreated, 1);
  assert.deepEqual(stats.orderRefs, ["orders:order:order-1001"]);
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
