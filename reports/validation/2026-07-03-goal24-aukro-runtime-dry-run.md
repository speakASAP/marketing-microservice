# Goal 24 Aukro Runtime Replay Dry-Run Validation

Date: 2026-07-03
Owner role: Integration validator

## IPS Chain

Vision -> Aukro marketplace purchase history can improve Catalog order-affinity relations without leaking buyer, address, payment, provider, token, credential, or raw marketplace payload data.
Goal Impact -> Marketing recurring order-affinity publish is no longer blocked by Aukro HTTP 404 or missing source allowlist; current Aukro replay data is empty.
System -> Aukro owns protected marketplace replay source; Marketing owns aggregation, dry-run ledger, scheduling, and Catalog publish orchestration; Catalog owns durable relation rows.
Feature -> Marketing `backfill:order-affinity` with `--source-owner=aukro-service` and Aukro protected replay endpoint.
Task -> Deploy Aukro replay endpoint, verify Marketing runtime token/path/source support, and run aggregate-only dry-run.
Execution Plan -> Runtime validation only; no live `--publish`, no Catalog mutation, no raw replay payload logging, no secret values printed.
Coding Prompt -> Use source-specific token selection and `/aukro/internal/aukro/order-affinity/replay-candidates`; keep sensitive fields fail-closed.
Code -> Aukro commit `c6f9e38`; Marketing commit `9f91c9f` already deployed.
Validation -> Commands below.
State Update -> Aukro replay endpoint is runtime-reachable by Marketing; current replay window has zero events.

## Validation Evidence

- Aukro deploy: `./scripts/deploy.sh` built and pushed `localhost:5000/aukro-service:c6f9e38`; initial rollout command timed out during image pull, later `kubectl rollout status deployment/aukro-service --timeout=300s` succeeded.
- Aukro health: in-pod Node fetch to `http://127.0.0.1:3700/health` returned HTTP 200 with `service=aukro-service`.
- Marketing source validation before runtime dry-run: focused order-affinity tests passed 26/26, `npm run build -- --pretty false` passed, `git diff --check` passed.
- Protected endpoint probe from Marketing pod: `http://aukro-service:3700/aukro/internal/aukro/order-affinity/replay-candidates?limit=5` returned HTTP 200, `success=true`, `count=0`, `events=0`.
- Marketing CLI dry-run: `node dist/order-affinity-backfill.js --marketplace-url http://aukro-service:3700 --source-owner aukro-service --channel aukro --limit 50 --dry-run --pretty` returned `status=dry_run_passed`, `inputRecords=0`, `acceptedCreatedEvents=0`, `aggregatePairs=0`, `ledgerRecord.status=recorded`, `idempotencyKeyCount=0`.

## Boundary Decisions

No live publish, Catalog mutation, DB migration, Kubernetes schedule activation, secret value output, raw order payload logging, customer/contact/address/payment/provider logging, or marketplace mutation was run.

## Remaining Blockers

- `[MISSING: non-empty Aukro multi-Catalog-product replay evidence]`
- `[MISSING: owner-approved Aukro recurring schedule activation policy]`
- `[MISSING: Catalog source/window scoped stale-affinity pruning or replacement API]`
- `[MISSING: Bazos order-affinity replay endpoint compatible with Marketing marketplace replay contract]`
