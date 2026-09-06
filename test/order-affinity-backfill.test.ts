import test from "node:test";
import assert from "node:assert/strict";
import { ORDERS_ORDER_CREATED_V1 } from "../src/order-lifecycle-events";
import { buildOrderAffinityBackfill, buildOrderAffinityBackfillLedgerEntry, chooseOrderAffinityCatalogPublishMode, marketplaceReplayPath, normalizeMarketplaceReplayEvents, orderAffinityMarketplaceReplayHeaders, orderAffinityMarketplaceReplayHeadersForSource, orderAffinityOrdersReplayHeaders } from "../src/order-affinity-backfill";
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


test("order affinity backfill normalizes FlipFlop protected replay response candidates", () => {
  const events = normalizeMarketplaceReplayEvents({
    sourceOwner: "flipflop-service",
    consumerOwner: "marketing-microservice",
    contract: "marketplace.order_affinity_replay_candidates.v1",
    channel: "flipflop",
    window: { from: "2026-07-02T00:00:00.000Z", to: "2026-07-03T00:00:00.000Z" },
    events: [
      {
        sourceOwner: "flipflop-service",
        consumerOwner: "marketing-microservice",
        contract: "marketplace.order_affinity_replay_candidates.v1",
        channel: "flipflop",
        replayRef: "flipflop-affinity:abc123",
        currency: "CZK",
        items: [
          { productId: "catalog-a", quantity: 1 },
          { productId: "catalog-b", quantity: 1 }
        ]
      }
    ]
  });
  const summary = buildOrderAffinityBackfill(events, { runId: "flipflop-replay" });

  assert.equal(summary.inputRecords, 1);
  assert.equal(summary.acceptedCreatedEvents, 1);
  assert.equal(summary.rejectedRecords, 0);
  assert.equal(summary.aggregatePairs, 2);
  assert.deepEqual(summary.byChannel, { flipflop: 1 });
});


test("order affinity Orders replay headers use internal service auth", () => {
  // The orders lane sends a per-pair RS256 principal as Bearer; orders verifies it
  // via /auth/validate rather than string-matching a shared secret.
  assert.deepEqual(orderAffinityOrdersReplayHeaders({ ORDERS_SERVICE_TOKEN: "orders-token" }), {
    "x-service-name": "marketing-microservice",
    authorization: "Bearer orders-token",
  });
  // An already-prefixed value must not end up as "Bearer Bearer ...".
  assert.deepEqual(orderAffinityOrdersReplayHeaders({ ORDERS_INTERNAL_SERVICE_TOKEN: "Bearer wrapped-token" }), {
    "x-service-name": "marketing-microservice",
    authorization: "Bearer wrapped-token",
  });
  assert.equal(orderAffinityOrdersReplayHeaders({}), undefined);
});

test("order affinity marketplace replay paths match approved source endpoints", () => {
  assert.equal(marketplaceReplayPath("aukro-service"), "/internal/aukro/order-affinity/replay-candidates");
  assert.equal(marketplaceReplayPath("bazos-service"), "/internal/bazos/order-affinity/replay-candidates");
  assert.equal(marketplaceReplayPath("flipflop-service"), "/internal/orders/order-affinity/replay-candidates");
  assert.equal(marketplaceReplayPath("allegro-service"), "/internal/allegro/order-affinity/replay-candidates");
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
  assert.deepEqual(orderAffinityMarketplaceReplayHeadersForSource("flipflop-service", { ORDER_AFFINITY_FLIPFLOP_REPLAY_TOKEN: "flipflop-token", ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN: "fallback" }), {
    "x-service-name": "marketing-microservice",
    "x-flipflop-internal-key": "flipflop-token",
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
    completeSnapshot: true,
  });

  assert.equal(ledger.mode, "dry-run");
  assert.equal(ledger.status, "dry_run_passed");
  assert.equal(ledger.sourceOwner, "allegro-service");
  assert.equal(ledger.channel, "allegro");
  assert.equal(ledger.inputRecords, 1);
  assert.equal(ledger.acceptedCreatedEvents, 1);
  assert.equal(ledger.aggregatePairs, 2);
  assert.equal(ledger.completeSnapshot, true);
  assert.deepEqual(ledger.catalogIdempotencyKeys, [
    "marketing_order_affinity:allegro-service:allegro:2026-07-01T00:00:00.000Z:2026-07-03T00:00:00.000Z:marketplace-affinity:allegro:2026-07-03:1",
    "marketing_order_affinity:allegro-service:allegro:2026-07-01T00:00:00.000Z:2026-07-03T00:00:00.000Z:marketplace-affinity:allegro:2026-07-03:2",
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
    sourceOwner: "allegro-service",
    channel: "allegro",
    windowStart: "2026-07-01T00:00:00.000Z",
    windowEnd: "2026-07-03T00:00:00.000Z",
    batchCount: 1,
  });
  assert.deepEqual(keys, ["marketing_order_affinity:allegro-service:allegro:2026-07-01T00:00:00.000Z:2026-07-03T00:00:00.000Z:run-1:1"]);

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


test("order affinity replace-window publishing fails closed without completeness and retention proof", () => {
  const summary = buildOrderAffinityBackfill([
    created("00000000-0000-4000-8000-000000000104", ["catalog-a", "catalog-b"], "allegro")
  ], { runId: "replace-window-run" });
  const ledger = buildOrderAffinityBackfillLedgerEntry(summary, {
    sourceOwner: "allegro-service",
    channel: "allegro",
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-03T00:00:00.000Z",
  });

  assert.deepEqual(chooseOrderAffinityCatalogPublishMode(summary, ledger, { replaceWindow: false }), { mode: "batch" });
  assert.deepEqual(chooseOrderAffinityCatalogPublishMode(summary, ledger, { replaceWindow: true }), {
    mode: "replace-window-blocked",
    reason: "replace_window_requires_complete_snapshot_ledger",
  });
  assert.deepEqual(chooseOrderAffinityCatalogPublishMode(summary, ledger, {
    replaceWindow: true,
    completeSnapshot: true,
    ownerRetentionPolicyRef: "owner-approved-retention-2026-07",
  }), {
    mode: "replace-window-blocked",
    reason: "replace_window_requires_complete_snapshot_ledger",
  });

  const completeLedger = buildOrderAffinityBackfillLedgerEntry(summary, {
    sourceOwner: "allegro-service",
    channel: "allegro",
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-03T00:00:00.000Z",
    completeSnapshot: true,
  });

  assert.deepEqual(chooseOrderAffinityCatalogPublishMode(summary, completeLedger, {
    replaceWindow: true,
    completeSnapshot: true,
  }), {
    mode: "replace-window-blocked",
    reason: "replace_window_requires_owner_retention_policy",
  });
  assert.deepEqual(chooseOrderAffinityCatalogPublishMode(summary, completeLedger, {
    replaceWindow: true,
    completeSnapshot: true,
    ownerRetentionPolicyRef: "owner-approved-retention-2026-07",
  }), { mode: "replace-window" });
});


test("order affinity replace-window publish mode sends complete source window payload", async () => {
  const summary = buildOrderAffinityBackfill([
    created("00000000-0000-4000-8000-000000000105", ["catalog-a", "catalog-b"], "allegro")
  ], { runId: "replace-window-publish-run" });
  const ledger = buildOrderAffinityBackfillLedgerEntry(summary, {
    sourceOwner: "allegro-service",
    channel: "allegro",
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-03T00:00:00.000Z",
    completeSnapshot: true,
  });
  const calls: Array<{ url: string; payload: any }> = [];
  const { publishOrderAffinityCandidatesToCatalog } = await import("../src/order-affinity-catalog-publisher");
  const signal = {
    eventType: ORDERS_ORDER_CREATED_V1,
    eventVersion: 1 as const,
    eventId: `backfill:${summary.runId}`,
    occurredAt: "2026-07-03T08:00:00.000Z",
    orderId: `backfill:${summary.runId}`,
  };

  const result = await publishOrderAffinityCandidatesToCatalog(signal, summary.candidates, {
    enabled: true,
    catalogServiceUrl: "http://catalog-microservice:3200",
    internalServiceToken: "catalog-write-token",
    endpoint: "/api/internal/product-relations/order-affinity/batch",
    replaceWindowEndpoint: "/api/internal/product-relations/order-affinity/replace-window",
    timeoutMs: 5000,
    batchSize: 1,
  }, async (url, payload, config) => {
    calls.push({ url, payload, config });
  }, {
    idempotencyKeys: ledger.catalogIdempotencyKeys,
    replaceWindow: {
      sourceOwner: ledger.sourceOwner,
      channel: ledger.channel,
      windowStart: ledger.windowStart!,
      windowEnd: ledger.windowEnd!,
      runId: ledger.runId,
    }
  });

  assert.equal(result.status, "published");
  assert.equal(result.batchCount, 1);
  assert.equal(calls[0].url, "http://catalog-microservice:3200/api/internal/product-relations/order-affinity/replace-window");
  // The publisher carries the per-pair principal as a bearer and carries the
  // prohibited shared-secret headers nowhere. Asserted explicitly because
  // catalog still accepts the legacy header until the last caller is migrated,
  // so a regression would authenticate successfully and be invisible.
  assert.equal(calls[0].config.headers.authorization, "Bearer catalog-write-token");
  assert.equal(calls[0].config.headers["x-internal-service-token"], undefined);
  assert.equal(calls[0].config.headers["x-service-name"], undefined);
  assert.equal(calls[0].payload.completeSnapshot, true);
  assert.equal(calls[0].payload.sourceOwner, "allegro-service");
  assert.equal(calls[0].payload.channel, "allegro");
  assert.equal(calls[0].payload.windowStart, "2026-07-01T00:00:00.000Z");
  assert.equal(calls[0].payload.windowEnd, "2026-07-03T00:00:00.000Z");
  assert.equal(calls[0].payload.idempotencyKey, ledger.catalogIdempotencyKeys[0]);
  assert.equal(calls[0].payload.items.length, 2);
});
