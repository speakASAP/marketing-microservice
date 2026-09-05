# Goal 24 Marketing Aukro Replay Path Source Validation

Date: 2026-07-03
Owner role: Marketing replay integration worker

## IPS Chain

Vision -> Aukro marketplace purchase history can improve Catalog order-affinity relations without leaking buyer, address, payment, provider, token, credential, or raw marketplace payload data.
Goal Impact -> Marketing resolves `aukro-service` replay to the merged Aukro endpoint path before any dry-run or publish attempt.
System -> Aukro owns protected replay source `GET /internal/aukro/order-affinity/replay-candidates`; Marketing owns source allowlist, aggregate parser/backfill, ledger, and guarded Catalog publishing.
Feature -> `--source-owner=aukro-service` marketplace replay path and token mapping.
Task -> verify/fix Marketing path/source allowlist/token mapping only.
Execution Plan -> source/tests/docs only in isolated remote worktree; no Catalog, Aukro, Orders, Kubernetes, secret, migration, deploy, live publish, or raw replay payload changes.
Coding Prompt -> fail closed, keep `source=aukro-service`, use `/internal/aukro/order-affinity/replay-candidates`, and output aggregate-safe evidence only.
Code -> `src/order-affinity-backfill.ts`, `test/order-affinity-backfill.test.ts`.
Validation -> focused `tsx --test` passed 29/29, `npm run build -- --pretty false` passed, and `git diff --check` passed.
State Update -> Aukro is now path-compatible in Marketing source; runtime redeploy/publish is intentionally not performed in this worker.

## Validation Scope

- Confirmed parser source allowlist already accepts `aukro-service` for `marketplace.order_affinity_candidate.v1`.
- Corrected Marketing Aukro replay path from the legacy prefixed form to `/internal/aukro/order-affinity/replay-candidates`.
- Added a source-to-path regression test for Aukro, Bazos, and Allegro.

## Command Evidence

- `NODE_PATH=/home/ssf/Documents/Github/marketing-microservice/node_modules /home/ssf/Documents/Github/marketing-microservice/node_modules/.bin/tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts` -> passed 29/29.
- `npm run build -- --pretty false` -> passed after temporarily symlinking the existing base checkout `node_modules` for TypeScript resolution; symlink removed after validation.
- `git diff --check` -> passed.

## Safety Boundary

No live publish, deploy, Kubernetes change, DB migration, secret read/write, Catalog mutation, Aukro source edit, Orders source edit, raw order/replay payload output, buyer/address/payment/provider output, or token value output was performed.

## Remaining Blockers

- `[MISSING: deployed Marketing image containing corrected Aukro replay path]`
- `[MISSING: non-empty Aukro multi-Catalog-product replay evidence]`
- `[MISSING: owner-approved Aukro recurring schedule activation policy]`
- `[MISSING: Catalog source/window scoped stale-affinity pruning or replacement API]`
