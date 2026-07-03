# VAL-GOAL-24 Marketplace Affinity Runtime

Date: 2026-07-03
Repository: `/home/ssf/Documents/Github/marketing-microservice`
Commit: `6ad9d3f docs: record flipflop order affinity dry run`

## IPS Chain

Vision -> marketplace purchase history can improve related-product evidence without copying buyer/address/payment/provider data into Marketing.
Goal Impact -> Marketing can parse the Allegro replay contract after deployment, but direct replay remains fail-closed until runtime service-token mapping is approved and configured.
System -> Marketing owns parser/backfill aggregation; Allegro owns the protected replay source; Catalog owns persisted relation writes.
Feature -> `marketplace.order_affinity_candidate.v1` parser and `--marketplace-url` backfill input.
Task -> deploy merged parser support and verify runtime readiness/fail-closed behavior.
Execution Plan -> deploy passive parser support, inspect token presence by name only, and run fail-closed dry-run without printing sensitive data.
Coding Prompt -> preserve source-owner validation and do not invent backend fields or service-token contracts.
Code -> deployed with `./scripts/deploy.sh`; live image tag reported as `localhost:5000/marketing-microservice:6ad9d3f` / deployment image `latest`.
Validation -> focused tests/build passed before push; deployment passed; token-presence check and fail-closed marketplace dry-run captured.
State Update -> Marketing parser/backfill support is live, but protected Allegro replay execution from Marketing is blocked by missing token mapping.

## Validation Evidence

Source validation before push:

- `git diff --check` passed.
- `npx tsx --test --test-concurrency=1 test/order-lifecycle-events.test.ts test/order-affinity-backfill.test.ts` passed: 20 tests, 20 pass.
- `npm run build` passed.
- `git push origin main` pushed the merge to `e171b73`, later included by deployed `origin/main` `6ad9d3f`.

Deployment/runtime evidence:

- `./scripts/deploy.sh` completed successfully.
- Deployment output reported `Image: localhost:5000/marketing-microservice:6ad9d3f`.
- `kubectl -n statex-apps get deploy marketing-microservice -o wide` showed `1/1` ready.
- Runtime token presence check printed names only:

```json
{
  "ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN": false,
  "ALLEGRO_INTERNAL_SERVICE_TOKEN": false,
  "INTERNAL_SERVICE_TOKEN": false,
  "ORDERS_SERVICE_TOKEN": true,
  "CATALOG_INTERNAL_SERVICE_TOKEN": true
}
```

Fail-closed protected replay attempt from Marketing:

```text
node dist/order-affinity-backfill.js --marketplace-url http://allegro-service.statex-apps.svc.cluster.local:3000 --limit 20 --dry-run --pretty
{"error":"Request failed with status code 401"}
```


## Orders Aggregate Count Check

A read-only Orders aggregate/count check was run through the protected replay endpoint using `MARKETING_INTERNAL_SERVICE_TOKEN` presence only and `x-service-name: marketing-microservice`. The reducer printed no customer, address, payment provider, token, raw order, or item payload data.

```json
{
  "tokenPresent": true,
  "status": 200,
  "success": true,
  "contract": "orders.order_affinity_replay_candidates.v1",
  "count": 2,
  "filterLimit": 200,
  "statuses": [
    "confirmed",
    "processing",
    "shipped",
    "delivered"
  ],
  "paymentStatuses": [
    "paid"
  ],
  "eventSampleCount": 2,
  "uniqueEventChannels": [
    "flipflop"
  ]
}
```


## Post-Deploy Token And Publish Evidence

After deploying image `5637276`, `marketing-microservice-secret` contained the new `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN` key. The running Marketing pod reported token presence by name only:

```json
{
  "ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN": true,
  "ALLEGRO_INTERNAL_SERVICE_TOKEN": false,
  "INTERNAL_SERVICE_TOKEN": false,
  "ORDERS_SERVICE_TOKEN": true,
  "CATALOG_INTERNAL_SERVICE_TOKEN": true
}
```

Protected Marketing-to-Allegro dry-run endpoint validation returned aggregate-only evidence:

```json
{
  "tokenPresent": true,
  "status": 200,
  "success": true,
  "contract": "marketplace.order_affinity_candidate.v1",
  "channel": "allegro",
  "count": 8,
  "skippedRecords": 92,
  "eventSampleCount": 8
}
```

Marketing CLI dry-run aggregate summary:

```json
{
  "mode": "dry-run",
  "summary": {
    "runId": "orders-history-2026-07-03",
    "inputRecords": 8,
    "acceptedCreatedEvents": 8,
    "rejectedRecords": 0,
    "skippedEvents": 0,
    "aggregatePairs": 16,
    "totalPairEvidence": 16
  },
  "ledgerRecord": {
    "status": "disabled",
    "reason": "ledger_disabled"
  }
}
```

Owner-approved live Catalog publish was then run from the qualified Allegro replay path with run id `allegro-affinity-live-2026-07-03`. Aggregate-only publish result:

```json
{
  "mode": "publish",
  "summary": {
    "runId": "allegro-affinity-live-2026-07-03",
    "inputRecords": 8,
    "acceptedCreatedEvents": 8,
    "rejectedRecords": 0,
    "skippedEvents": 0,
    "aggregatePairs": 16,
    "totalPairEvidence": 16
  },
  "ledgerRecord": {
    "status": "disabled",
    "runId": "allegro-affinity-live-2026-07-03",
    "idempotencyKeyCount": 1,
    "reason": "ledger_disabled"
  },
  "publish": {
    "status": "published",
    "candidateCount": 16,
    "batchCount": 1,
    "endpoint": "http://catalog-microservice.statex-apps.svc.cluster.local:3200/api/internal/product-relations/order-affinity/batch"
  }
}
```

No customer, address, payment, provider, token value, raw marketplace order id, raw event payload, or raw Catalog relation payload was printed.


## Ledger Migration And Recording Evidence

Owner approval received on 2026-07-03 to apply the Marketing order-affinity ledger migration and enable runtime ledger recording before scheduling recurring publishes.

Migration/config evidence:

- `DB_AUTO_CREATE=true` was already present in the Marketing runtime.
- Live schema/count check printed aggregate metadata only:

```json
{
  "runsTablePresent": true,
  "keysTablePresent": true,
  "runCount": 0,
  "keyCount": 0,
  "error": null
}
```

- `k8s/configmap.yaml` now sets `ORDER_AFFINITY_RUN_LEDGER_ENABLED: "true"`.
- `kubectl apply --dry-run=server -f k8s/configmap.yaml -n statex-apps` passed.
- Marketing deployed image `470ce7a`; runtime presence check showed `ORDER_AFFINITY_RUN_LEDGER_ENABLED`, `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN`, `CATALOG_INTERNAL_SERVICE_TOKEN`, and DB connection keys present by name only.

Ledger recording validation:

```json
{
  "mode": "dry-run",
  "summary": {
    "runId": "allegro-affinity-ledger-dry-run-2026-07-03",
    "inputRecords": 8,
    "acceptedCreatedEvents": 8,
    "rejectedRecords": 0,
    "skippedEvents": 0,
    "aggregatePairs": 16,
    "totalPairEvidence": 16
  },
  "ledgerRecord": {
    "status": "recorded",
    "runId": "allegro-affinity-ledger-dry-run-2026-07-03",
    "idempotencyKeyCount": 1
  }
}
```

Persisted aggregate-only DB verification:

```json
{
  "found": true,
  "row": {
    "run_id": "allegro-affinity-ledger-dry-run-2026-07-03",
    "source_owner": "allegro-service",
    "channel": "allegro",
    "mode": "dry-run",
    "status": "dry_run_passed",
    "input_records": 8,
    "accepted_created_events": 8,
    "rejected_records": 0,
    "skipped_events": 0,
    "aggregate_pairs": 16,
    "total_pair_evidence": 16,
    "batch_count": 1,
    "idempotency_key_count": 1
  },
  "keyRows": 1,
  "totalRuns": 2
}
```

No DSN, password, token value, customer, address, payment, provider, raw marketplace order id, raw event payload, or raw Catalog relation payload was printed.

## Privacy Boundary

No customer, address, payment, provider, token value, raw marketplace order id, raw event payload, or raw Catalog relation payload was printed in runtime validation evidence.


## Approved Token Mapping Plan

Owner approval received on 2026-07-03 to find or create the replay token in Kubernetes Vault. The existing Vault-backed Allegro service token source was found without printing token values: Orders maps `ALLEGRO_INTERNAL_SERVICE_TOKEN` from `secret/prod/allegro-service` property `JWT_TOKEN`. Marketing now maps the same Vault property into its own secret as `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN`, preserving an explicit purpose-specific runtime name for the backfill CLI.

No new raw token value was created, printed, copied into code, or committed.

## Blockers

- `[MISSING: recurring affinity publish schedule/policy with ledger-required guard]`.

## Complete Snapshot Runtime Deployment And Smoke

Owner approval source: W2 Marketing affinity ledger worker thread `019f268e-bf2c-7171-a545-bc810c99111d` explicitly approved the runtime/integration owner to run the Marketing deploy/migration/runtime smoke for Goal 24.

Runtime action:

- Deployed current Marketing `main` at `0aa47ed` with `./scripts/deploy.sh`.
- Deployment completed successfully in 60.46s and reported image `localhost:5000/marketing-microservice:0aa47ed`.
- Live deployment remained ready `1/1`.
- `DB_AUTO_CREATE=true` caused sorted SQL migrations to be applied on startup.

Runtime schema proof:

```json
{
  "column_name": "complete_snapshot",
  "data_type": "boolean",
  "column_default": "false",
  "is_nullable": "NO"
}
```

Aggregate-only runtime smoke:

- Dry-run run id: `goal24-complete-snapshot-smoke-20260703123503`.
- `ledgerRecord.status=recorded`.
- Persisted `complete_snapshot=true`.
- `inputRecords=0`, `aggregatePairs=0`, `idempotencyKeyCount=0`.
- No Catalog publish was run.

Guard proof:

- Replace-window publish attempt without owner retention policy returned `publish.status=failed` and `publish.reason=replace_window_requires_owner_retention_policy`.
- `ledgerRecordPresent=false`, so the blocked publish did not create a ledger record or call Catalog.

Resolved blocker:

- `[RESOLVED: deploy/apply updated Marketing ledger migration containing complete_snapshot]`

Remaining blockers:

- `[MISSING: owner-approved source/window for any future replace-window publish]`
- `[MISSING: non-empty real Aukro multi-Catalog-product replay evidence]`
- `[MISSING: owner-approved Aukro source/window recurring schedule activation policy]`
- `[MISSING: Bazos paid order history source]`
- `[MISSING: Bazos persisted order item replay source]`
- `[MISSING: Bazos order item ingestion contract]`
- `[RESOLVED: deployed FlipFlop replay endpoint/runtime smoke]`
- `[RESOLVED: owner-approved conservative FlipFlop marketplace replay activation policy - no recurring marketplace CronJob, publish, or replace-window activation without future explicit source/window approval]`
- `[MISSING: owner-approved FlipFlop recurring marketplace publish/replace-window schedule activation]`
