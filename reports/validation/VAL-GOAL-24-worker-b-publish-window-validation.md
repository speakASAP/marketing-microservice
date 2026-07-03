# VAL-GOAL-24 Worker B Publish-Window Validation

Date: 2026-07-03
Repository: `/home/ssf/Documents/Github/marketing-microservice`
Role: Goal 24 worker B
Mode: validation-only, fail-closed for new Catalog mutation

## Intent Preservation Chain

- Vision: purchase and marketplace history can improve Catalog-owned product relations without copying customer, address, payment, provider, token, or raw order payload data.
- Goal Impact: currently passing order-affinity sources were revalidated for aggregate-only readiness, while avoiding an unsafe repeat publish.
- System: Orders and marketplace services own replay facts, Marketing owns aggregation/idempotency/publish orchestration, and Catalog owns durable product relation rows.
- Feature: first/next Catalog order-affinity publish-window guard validation.
- Task: verify Catalog endpoint contract, Marketing bounded payload path, idempotency evidence, ledger/readback posture, approval evidence, and dry-run counts for central Orders, FlipFlop Orders, and Allegro.
- Execution Plan: inspect remote docs/source/runtime; run dry-run-only aggregate validations; do not run `--publish`, DB migrations, direct Catalog table writes, deployments, or raw payload logging.
- Coding Prompt: fail closed unless all mutation guards are concrete and current.
- Code: validation report only; no source code changed by this worker.
- Validation: aggregate dry-runs and repo checks recorded below.
- State Update: no new Catalog publish was performed.

## Publish Decision

Blocked for this worker. No new `--publish` command was run.

Reasons:

- The repo/status already records owner-approved live publishes for central Orders FlipFlop and Allegro on 2026-07-03, so this is no longer a first publish window.
- Marketing runtime currently has `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true` and `ORDER_AFFINITY_RUN_LEDGER_ENABLED=true`; a dry-run against Allegro recorded an aggregate ledger row. Repeating publish would add side effects beyond the delegated validation-only posture.
- The working tree already contains uncommitted source changes in `src/order-affinity-ledger.ts` and untracked `src/order-affinity-schedule-policy.ts`; this worker did not overwrite or commit them.
- Scheduled/idempotent marketplace-wide orchestration, stale-row pruning/replacement semantics, and durable owner-run replay contracts remain incomplete for future broad runs.

## Runtime Guard Evidence

Marketing deployment:

```json
{
  "image": "localhost:5000/marketing-microservice:latest",
  "rollout": "success",
  "readyPod": "marketing-microservice-7544f448fd-pqhgh"
}
```

Runtime env presence checked from Node without printing secret values:

```json
{
  "ORDER_AFFINITY_RUN_LEDGER_ENABLED": "true",
  "ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED": "true",
  "ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN": true,
  "CATALOG_INTERNAL_SERVICE_TOKEN": true,
  "ORDERS_SERVICE_TOKEN": true
}
```

Catalog source contract verified:

- `POST /api/internal/product-relations/order-affinity/batch` is protected by `CatalogAuthGuard`.
- The endpoint requires internal/admin roles through `RequireCatalogRoles`.
- Catalog forces `relationType=order_affinity` and `source=marketing_order_affinity` server-side.
- Catalog validates product existence/visibility and upserts on relation key.
- First-version semantics remain upsert-only: no delete/prune, no marketplace publication, no bundle SKU, no checkout, no Warehouse, no Payments mutation.

Marketing source contract verified:

- The backfill CLI reads central Orders replay or marketplace replay input.
- Candidate output is bounded to directed product pairs with score/confidence/source metadata.
- Publish path is opt-in through `--publish` and `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true`.
- Catalog calls use `x-internal-service-token` and do not write Catalog tables directly.
- Public summaries omit raw events and sensitive order/customer/payment/provider fields.

## Dry-Run Evidence

Central Orders dry-run:

```json
{
  "source": "central-orders",
  "mode": "dry-run",
  "runId": "worker-b-central-orders-20260703",
  "inputRecords": 2,
  "acceptedCreatedEvents": 2,
  "rejectedRecords": 0,
  "skippedEvents": 0,
  "aggregatePairs": 2,
  "totalPairEvidence": 4,
  "byChannel": { "flipflop": 2 },
  "ledgerRecord": {
    "status": "disabled",
    "reason": "ledger_disabled",
    "idempotencyKeyCount": 1
  },
  "catalogIdempotencyKeys": [
    "marketing_order_affinity:orders-microservice:flipflop:open:open:worker-b-central-orders-20260703:1"
  ]
}
```

FlipFlop Orders dry-run:

```json
{
  "source": "flipflop-orders",
  "mode": "dry-run",
  "runId": "worker-b-flipflop-orders-20260703",
  "inputRecords": 2,
  "acceptedCreatedEvents": 2,
  "rejectedRecords": 0,
  "skippedEvents": 0,
  "aggregatePairs": 2,
  "totalPairEvidence": 4,
  "byChannel": { "flipflop": 2 },
  "ledgerRecord": {
    "status": "disabled",
    "reason": "ledger_disabled",
    "idempotencyKeyCount": 1
  },
  "catalogIdempotencyKeys": [
    "marketing_order_affinity:orders-microservice:flipflop:open:open:worker-b-flipflop-orders-20260703:1"
  ]
}
```

Allegro protected replay dry-run:

```json
{
  "source": "allegro",
  "mode": "dry-run",
  "runId": "worker-b-allegro-20260703",
  "inputRecords": 8,
  "acceptedCreatedEvents": 8,
  "rejectedRecords": 0,
  "skippedEvents": 0,
  "aggregatePairs": 16,
  "totalPairEvidence": 16,
  "byChannel": { "allegro": 8 },
  "ledgerRecord": {
    "status": "recorded",
    "idempotencyKeyCount": 1
  },
  "catalogIdempotencyKeys": [
    "marketing_order_affinity:allegro-service:allegro:open:open:worker-b-allegro-20260703:1"
  ]
}
```

Privacy boundary: validation output stayed aggregate-only. No raw order rows, raw marketplace payloads, customer/contact/address/payment/provider data, tokens, credentials, or secret values were printed.

## Blockers

- `[MISSING: scheduled/idempotent central Orders backfill policy for future runs beyond the owner-reviewed window]`
- `[MISSING: scheduled/idempotent marketplace-wide backfill orchestration across Allegro, Aukro, Bazos, FlipFlop, and central Orders]`
- `[MISSING: Catalog source/window scoped stale-affinity pruning or replacement API]`
- `[MISSING: owner-approved retention/decay policy for stale affinity rows]`
- `[MISSING: durable owner-run replay/export contracts for all non-Allegro marketplace sources]`
- `[UNKNOWN: whether the uncommitted Marketing ledger/schedule source changes are final integration-owner changes or in-progress worker changes]`

## Parallel Execution

- `ready now`: integration owner reviews the dirty Marketing ledger/schedule worktree and decides whether to merge, revise, or isolate it.
- `ready now`: validation owner can rerun dry-run matrix after the worktree is clean and deployment image is pinned to a known commit.
- `dependency-gated`: next publish window for any source. Dependencies: clean/committed source, explicit owner-approved source/window, durable ledger policy, dry-run counts immediately before publish, and stale-row retention/pruning decision.
- `blocked`: marketplace-wide automation. Blockers: source-owned replay contracts for Aukro/Bazos/FlipFlop, scheduler policy, and replacement semantics.

Shared files/contracts: Marketing `docs/agents/contracts/orders-events-integration-contract.md`, Catalog `docs/contracts/catalog-product-relations.md`, Catalog `docs/contracts/catalog-marketplace-affinity-backfill.md`.

Integration owner: Marketing/Catalog Goal 24 orchestrator.

Validation owner: integration validator.

Merge order: reconcile Marketing ledger/schedule source changes, update contracts if idempotency shape changed, rerun focused tests/build/diff check, then consider another owner-approved publish window.

## Validation Commands

```bash
kubectl -n statex-apps exec deploy/marketing-microservice -- node dist/order-affinity-backfill.js --orders-url http://orders-microservice.statex-apps.svc.cluster.local:3203 --limit=50 --run-id worker-b-central-orders-20260703 --dry-run
```

Result: passed, aggregate-only summary above.

```bash
kubectl -n statex-apps exec deploy/marketing-microservice -- node dist/order-affinity-backfill.js --orders-url http://orders-microservice.statex-apps.svc.cluster.local:3203 --channel=flipflop --limit=20 --run-id worker-b-flipflop-orders-20260703 --dry-run
```

Result: passed, aggregate-only summary above.

```bash
kubectl -n statex-apps exec deploy/marketing-microservice -- node dist/order-affinity-backfill.js --marketplace-url http://allegro-service.statex-apps.svc.cluster.local:3000 --limit=50 --run-id worker-b-allegro-20260703 --dry-run
```

Result: passed, aggregate-only summary above; dry-run ledger row recorded because runtime ledger is enabled.


## Post-Report Validation

```bash
git diff --check
```

Result: FAILED on pre-existing dirty source file `src/order-affinity-ledger.ts:264` with `new blank line at EOF`. The docs added by this worker were checked separately with `git diff --check -- reports/validation/VAL-GOAL-24-worker-b-publish-window-validation.md docs/orchestrator/STATUS.md` and passed.

```bash
npx tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts
```

Result: FAILED, 21/23 passed. The two failures are in `test/order-affinity-backfill.test.ts` and show the dirty `src/order-affinity-ledger.ts` changed Catalog idempotency keys from the expected source/channel/window scoped shape to `marketing_order_affinity:backfill:<runId>:<batchIndex>`. This confirms the idempotency contract is not safe for a new publish until the integration owner reconciles source, tests, and docs.

```bash
npm run build
```

Result: PASSED.

## Reconciliation Update After Owner Approval

Owner approval was treated as approval to reconcile the dirty source lane, not as approval for a new live Catalog publish. No `--publish` against live replay sources was run.

Source reconciliation completed:

- Scheduled backfills now derive closed UTC windows through `--schedule=daily|hourly` plus `--lookback` and `--window-delay-minutes`.
- Scheduled runs require explicit `--channel`; implicit broad-channel scheduling fails closed.
- Catalog idempotency keys are now aligned with the existing publisher event-id shape: `marketing_order_affinity:backfill:<runId>:<batchIndex>`.
- Scheduled publish attempts record a planned ledger first; if ledger recording is not successful, the publish result is blocked with `scheduled_publish_ledger_not_recorded` before any Catalog call.

Validation after reconciliation:

```bash
git diff --check
```

Result: PASS.

```bash
npx tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts
```

Result: PASS, 25/25 tests.

```bash
npm run build
```

Result: PASS.

```bash
npm test
```

Result: PASS, 101/101 tests. The suite emitted expected test-fixture audit-log DNS warnings for `logging-microservice`, but exited 0.

```bash
ORDER_AFFINITY_RUN_LEDGER_ENABLED= CATALOG_SERVICE_URL= CATALOG_INTERNAL_SERVICE_TOKEN= npx tsx src/order-affinity-backfill.ts --file /tmp/goal24-scheduled-gate-fixture.json --schedule=daily --schedule-at=2026-07-03T06:30:00.000Z --channel=flipflop --publish --record-ledger --pretty
```

Result: PASS as a fail-closed smoke. Output summary: `runId=order-affinity:orders-microservice:flipflop:daily:20260702T000000Z:20260703T000000Z`, `ledgerRecord.status=disabled`, `ledgerRecord.reason=ledger_disabled`, `publish.status=failed`, `publish.reason=scheduled_publish_ledger_not_recorded`. No Catalog publish was attempted.
