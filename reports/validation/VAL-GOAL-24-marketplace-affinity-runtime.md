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

## Privacy Boundary

No customer, address, payment, provider, token value, raw marketplace order id, raw event payload, or raw Catalog relation payload was printed in runtime validation evidence.


## Approved Token Mapping Plan

Owner approval received on 2026-07-03 to find or create the replay token in Kubernetes Vault. The existing Vault-backed Allegro service token source was found without printing token values: Orders maps `ALLEGRO_INTERNAL_SERVICE_TOKEN` from `secret/prod/allegro-service` property `JWT_TOKEN`. Marketing now maps the same Vault property into its own secret as `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN`, preserving an explicit purpose-specific runtime name for the backfill CLI.

No new raw token value was created, printed, copied into code, or committed.

## Blockers

- `[MISSING: post-deploy confirmation that ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN is present in the Marketing pod]`.
- `[MISSING: post-deploy Marketing-to-Allegro marketplace replay dry-run with aggregate-only output]`.
