# Orders Events Integration Contract

## Intent

Orders owns order lifecycle events and bounded order-item signal facts. Marketing consumes those signals for attribution and product-affinity candidate generation. Catalog remains the durable owner of product relation rows.

This contract preserves the boundary between order truth, marketing signal processing, and catalog product relation storage.

## Event Source

- Exchange: `orders.events`
- Producer owner: `orders-microservice`
- Consumer owner: `marketing-microservice`
- Accepted event version: `eventVersion = 1`
- Accepted source: `source = orders-microservice`

Accepted routing keys:

- `orders.order.created.v1`
- `orders.order.updated.v1`

Rejected routing key:

- `orders.order.status_changed.v1` is not accepted for the current producer contract; Marketing binds `orders.order.updated.v1` instead.

## Created Event Payload

Allowed fields for `orders.order.created.v1`:

- `orderId`
- `channel`
- `leadAttribution`
- `items`
- `currency`

Allowed `leadAttribution` fields:

- `leadId`
- `source`
- `campaignId`

Allowed `items[]` fields:

- `productId`
- `sku`
- `quantity`
- `unitPrice`
- `totalPrice`

Marketing converts valid item product IDs to refs in this format:

```text
catalog:product:<productId>
```

Created events without `items[]` remain valid for backwards compatibility. They cannot produce product-affinity candidates.

## Updated Event Payload

Allowed fields for `orders.order.updated.v1`:

- `orderId`
- `status`
- `previousStatus`
- `approval`

Allowed `approval` fields:

- `approvalType`
- `reasonCode`
- `sideEffectsHandled`
- `approvedAt`

## Forbidden Data

Marketing must reject event payloads that include customer, address, billing, payment method, provider secret, bearer token, JWT, password, credential, tracking number, tracking URL, operator email, approver email, email, or phone fields.

Marketing must not copy full order payloads, raw order-item product truth, customer identity, address, payment, tracking, provider, credential, or product-title data into product-affinity artifacts.

## Product Affinity Candidate Contract

Marketing may derive in-memory Catalog relation candidates only from accepted `orders.order.created.v1` signals with at least two unique `catalog:product:<id>` refs.

Candidate generation rules:

- Deduplicate product IDs.
- Sort product IDs deterministically.
- Emit directed pairs for every `sourceProductId != targetProductId`.
- Use `relationType = order_affinity`.
- Use `source = marketing_order_affinity`.
- Use initial `score = 1` and `confidence = 0.5` for single-order co-purchase evidence.
- Keep evidence bounded and non-sensitive.

Candidate item shape:

```json
{
  "sourceProductId": "catalog-product-1001",
  "targetProductId": "catalog-product-2002",
  "relationType": "order_affinity",
  "score": 1,
  "confidence": 0.5,
  "source": "marketing_order_affinity",
  "evidence": {
    "sourceSystem": "marketing-microservice",
    "sourceEventType": "orders.order.created.v1",
    "candidateId": "orders.order.created.v1:<eventId>:<sourceProductId>:<targetProductId>",
    "channel": "flipflop",
    "currency": "CZK",
    "productCount": 2,
    "reason": "single_order_copurchase"
  }
}
```

`candidateId` is an idempotency-friendly signal identifier. It must not contain customer IDs, raw order IDs, emails, tokens, payment data, addresses, tracking data, or full order payload fragments.

## Future Catalog Batch Ingestion Contract

Marketing must not write directly to Catalog tables. The future write path is a protected Catalog-owned endpoint:

```text
POST /api/internal/product-relations/order-affinity/batch
```

Recommended batch payload:

```json
{
  "source": "marketing_order_affinity",
  "idempotencyKey": "marketing_order_affinity:2026-07-02T10:00:00Z:batch-001",
  "generatedAt": "2026-07-02T10:00:00.000Z",
  "items": []
}
```

Catalog must force `relationType = order_affinity` and `source = marketing_order_affinity` server-side, validate product visibility and relation constraints, upsert idempotently on the Catalog relation unique key, and return per-item results.

First version semantics:

- Upsert only.
- No delete/prune of missing rows.
- No marketplace publication.
- No bundle SKU creation.
- No checkout, warehouse, payment, or free-shipping mutation.

## Current Blockers

- `[MISSING: runtime Catalog internal service token secret mapping for Marketing-to-Catalog relation writes]`
- Idempotency is source-implemented for replay batches as `marketing_order_affinity:<sourceOwner>:<channel>:<windowStart>:<windowEnd>:<runId>:<batchIndex>`; live replay evidence is still required after enabling the publisher.
- `[MISSING: pruning/replacement semantics for stale affinity rows]`
- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`

## Validation

Marketing source validation:

```bash
npx tsx --test --test-concurrency=1 test/order-lifecycle-events.test.ts
npm run build -- --pretty false
npm test
git diff --check
```

Catalog runtime ingestion validation exists in `catalog-microservice`; Marketing source now includes a guarded caller that remains disabled unless `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true` and `CATALOG_INTERNAL_SERVICE_TOKEN` are configured.

## Marketplace Order-Affinity Replay Envelopes

Marketing now accepts marketplace-owned replay envelopes for order-affinity backfill without weakening the canonical Orders lifecycle event parser.

Accepted first producer:

- `source=allegro-service`
- `type=marketplace.order_affinity_candidate.v1`
- `eventVersion=1`
- payload fields: `orderId`, `channel`, `currency`, `items[]`
- item fields: `productId`, optional `sku`, `quantity`, optional `unitPrice`, optional `totalPrice`

The parser normalizes accepted marketplace envelopes into the existing order-created signal used by `backfill:order-affinity`. Forbidden customer, address, billing, payment provider, token, credential, tracking, email, and phone fields still fail closed.

Runtime scheduling now has source support for an opt-in durable run ledger and idempotency registry:

- migration `0013_order_affinity_run_ledger.sql` creates `marketing_order_affinity_runs` and `marketing_order_affinity_idempotency_keys`.
- `ORDER_AFFINITY_RUN_LEDGER_ENABLED=true` gates DB writes; without it, dry-runs expose the planned ledger and return `ledger_disabled` without mutating storage.
- Catalog batch idempotency keys use `marketing_order_affinity:<sourceOwner>:<channel>:<windowStart>:<windowEnd>:<runId>:<batchIndex>`.
- Ledger rows store aggregate-safe counts, source/window/cursor metadata, rejection maps, channel maps, and idempotency keys only.
- Raw events, raw order ids, customer/contact/address/payment/provider payloads, tokens, credentials, and marketplace JSON are forbidden from ledger rows.

Runtime scheduling remains blocked by `[MISSING: scheduled dry-run matrix across Allegro, Aukro, Bazos, FlipFlop, and central Orders]` and `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`.
