import test from "node:test";
import assert from "node:assert/strict";
import { ORDERS_ORDER_CREATED_V1 } from "../src/order-lifecycle-events";
import { buildOrderAffinityBackfill, buildOrderAffinityBackfillLedgerEntry, orderAffinityMarketplaceReplayHeaders, orderAffinityMarketplaceReplayHeadersForSource, orderAffinityOrdersReplayHeaders } from "../src/order-affinity-backfill";
import { buildCatalogIdempotencyKeys, orderAffinityRunLedgerOptionsFromEnv, recordOrderAffinityRunLedger } from "../src/order-affinity-ledger";
import { buildOrderAffinitySchedulePolicy } from "../src/order-affinity-schedule-policy";

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


test("order affinity Orders replay headers use internal service auth", () => {
  assert.deepEqual(orderAffinityOrdersReplayHeaders({ ORDERS_SERVICE_TOKEN: "orders-token" }), {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": "orders-token",
  });
  assert.deepEqual(orderAffinityOrdersReplayHeaders({ ORDERS_INTERNAL_SERVICE_TOKEN: "Bearer wrapped-token" }), {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": "wrapped-token",
  });
  assert.equal(orderAffinityOrdersReplayHeaders({}), undefined);
});

test("order affinity marketplace replay headers use internal service auth", () => {
  assert.deepEqual(orderAffinityMarketplaceReplayHeaders({ ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN: "marketplace-token" }), {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": "marketplace-token",
  });
  assert.deepEqual(orderAffinityMarketplaceReplayHeaders({ ALLEGRO_INTERNAL_SERVICE_TOKEN: "Bearer wrapped-token" }), {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": "wrapped-token",
  });
  assert.deepEqual(orderAffinityMarketplaceReplayHeadersForSource("aukro-service", { ORDER_AFFINITY_AUKRO_REPLAY_TOKEN: "aukro-token", ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN: "fallback" }), {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": "aukro-token",
  });
  assert.deepEqual(orderAffinityMarketplaceReplayHeadersForSource("bazos-service", { ORDER_AFFINITY_BAZOS_REPLAY_TOKEN: "bazos-token", ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN: "fallback" }), {
    "x-service-name": "marketing-microservice",
    "x-internal-service-token": "bazos-token",
  });
  assert.equal(orderAffinityMarketplaceReplayHeaders({}), undefined);
});

test("order affinity backfill builds dry-run ledger with publisher-compatible Catalog idempotency keys", () => {
  const summary = buildOrderAffinityBackfill([
    created("00000000-0000-4000-8000-000000000101", ["catalog-a", "catalog-b"], "allegro")
  ], { runId: "marketplace-affinity:allegro:2026-07-03" });

  const ledger = buildOrderAffinityBackfillLedgerEntry(summary, {
    sourceOwner: "allegro-service",
    channel: "allegro",
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-03T00:00:00.000Z",
    cursorBefore: "cursor-before",
    cursorAfter: "cursor-after",
    batchCount: 2,
  });

  assert.equal(ledger.mode, "dry-run");
  assert.equal(ledger.status, "dry_run_passed");
  assert.equal(ledger.sourceOwner, "allegro-service");
  assert.equal(ledger.channel, "allegro");
  assert.equal(ledger.inputRecords, 1);
  assert.equal(ledger.acceptedCreatedEvents, 1);
  assert.equal(ledger.aggregatePairs, 2);
  assert.deepEqual(ledger.catalogIdempotencyKeys, [
    "marketing_order_affinity:backfill:marketplace-affinity:allegro:2026-07-03:1",
    "marketing_order_affinity:backfill:marketplace-affinity:allegro:2026-07-03:2",
  ]);
  const serialized = JSON.stringify(ledger);
  assert.equal(serialized.includes("buyer@example.invalid"), false);
  assert.equal(serialized.includes("payment"), false);
});


test("order affinity schedule policy builds closed UTC windows and stable run ids", () => {
  const policy = buildOrderAffinitySchedulePolicy({
    schedule: "daily",
    scheduleAt: "2026-07-03T06:30:00.000Z",
    channel: "flipflop",
  });

  assert.equal(policy.schedule, "daily");
  assert.equal(policy.sourceOwner, "orders-microservice");
  assert.equal(policy.channel, "flipflop");
  assert.equal(policy.from, "2026-07-02T00:00:00.000Z");
  assert.equal(policy.to, "2026-07-03T00:00:00.000Z");
  assert.equal(policy.runId, "order-affinity:orders-microservice:flipflop:daily:20260702T000000Z:20260703T000000Z");
});

test("order affinity schedule policy requires an explicit channel", () => {
  assert.throws(() => buildOrderAffinitySchedulePolicy({ schedule: "daily" }), /order_affinity_schedule_channel_missing/);
});

test("order affinity ledger env config and disabled recording are fail-closed", async () => {
  const keys = buildCatalogIdempotencyKeys({
    runId: "run-1",
    batchCount: 1,
  });
  assert.deepEqual(keys, ["marketing_order_affinity:backfill:run-1:1"]);

  const options = orderAffinityRunLedgerOptionsFromEnv({ ORDER_AFFINITY_RUN_LEDGER_ENABLED: "true", DB_HOST: "database-server", DB_NAME: "marketing" });
  assert.equal(options.enabled, true);
  assert.equal(options.dbHost, "database-server");
  assert.equal(options.dbName, "marketing");

  const summary = buildOrderAffinityBackfill([
    created("00000000-0000-4000-8000-000000000102", ["catalog-a", "catalog-b"], "allegro")
  ], { runId: "run-disabled" });
  const ledger = buildOrderAffinityBackfillLedgerEntry(summary, { sourceOwner: "allegro-service", channel: "allegro" });
  const result = await recordOrderAffinityRunLedger(ledger, { enabled: false });
  assert.equal(result.status, "disabled");
  assert.equal(result.reason, "ledger_disabled");
});

test("order affinity ledger records aggregate-only rows and idempotency registry", async () => {
  const summary = buildOrderAffinityBackfill([
    created("00000000-0000-4000-8000-000000000103", ["catalog-a", "catalog-b"], "allegro")
  ], { runId: "run-record" });
  const ledger = buildOrderAffinityBackfillLedgerEntry(summary, {
    sourceOwner: "allegro-service",
    channel: "allegro",
    batchCount: 2,
  });
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as never;

  const result = await recordOrderAffinityRunLedger(ledger, { enabled: true }, pool);

  assert.equal(result.status, "recorded");
  assert.equal(result.idempotencyKeyCount, 2);
  assert.ok(queries.some((query) => query.text.includes("insert into marketing_order_affinity_runs")));
  assert.equal(queries.filter((query) => query.text.includes("insert into marketing_order_affinity_idempotency_keys")).length, 2);
  const runInsert = queries.find((query) => query.text.includes("insert into marketing_order_affinity_runs"));
  assert.equal(runInsert?.values?.[0], "run-record");
  assert.equal(runInsert?.values?.[1], "allegro-service");
  assert.equal(runInsert?.values?.[2], "allegro");
  assert.equal(JSON.stringify(runInsert?.values).includes("buyer@example.invalid"), false);
});
