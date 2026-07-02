import test from "node:test";
import assert from "node:assert/strict";
import { ORDERS_ORDER_CREATED_V1 } from "../src/order-lifecycle-events";
import { buildOrderAffinityBackfill } from "../src/order-affinity-backfill";

function created(eventId: string, productIds: string[], channel = "flipflop") {
  return {
    type: ORDERS_ORDER_CREATED_V1,
    eventVersion: 1,
    eventId,
    occurredAt: "2026-07-03T08:00:00.000Z",
    source: "orders-microservice",
    payload: {
      orderId: `order-${eventId}`,
      channel,
      currency: "CZK",
      items: productIds.map((productId) => ({ productId, quantity: 1 }))
    }
  };
}

test("order affinity backfill aggregates directed historical pairs without raw order output", () => {
  const summary = buildOrderAffinityBackfill([
    created("00000000-0000-4000-8000-000000000001", ["catalog-a", "catalog-b"]),
    created("00000000-0000-4000-8000-000000000002", ["catalog-b", "catalog-a", "catalog-a"]),
    created("00000000-0000-4000-8000-000000000003", ["catalog-a"]),
  ], { runId: "unit-test" });

  assert.equal(summary.inputRecords, 3);
  assert.equal(summary.acceptedCreatedEvents, 2);
  assert.equal(summary.skippedEvents, 1);
  assert.equal(summary.aggregatePairs, 2);
  assert.deepEqual(summary.candidates.map((candidate) => ({
    sourceProductId: candidate.sourceProductId,
    targetProductId: candidate.targetProductId,
    score: candidate.score,
    confidence: candidate.confidence,
    candidateId: candidate.evidence.candidateId,
  })), [
    {
      sourceProductId: "catalog-a",
      targetProductId: "catalog-b",
      score: 2,
      confidence: 0.65,
      candidateId: "orders.order.created.v1:historical:unit-test:catalog-a:catalog-b",
    },
    {
      sourceProductId: "catalog-b",
      targetProductId: "catalog-a",
      score: 2,
      confidence: 0.65,
      candidateId: "orders.order.created.v1:historical:unit-test:catalog-b:catalog-a",
    },
  ]);
});

test("order affinity backfill accepts outbox row wrappers", () => {
  const summary = buildOrderAffinityBackfill([
    {
      routingKey: ORDERS_ORDER_CREATED_V1,
      payload: created("00000000-0000-4000-8000-000000000004", ["catalog-a", "catalog-c"]),
    }
  ], { runId: "outbox" });

  assert.equal(summary.acceptedCreatedEvents, 1);
  assert.equal(summary.aggregatePairs, 2);
});
