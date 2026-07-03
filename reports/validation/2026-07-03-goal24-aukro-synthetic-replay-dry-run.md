# Goal 24 Aukro Synthetic Replay Dry-Run Validation

Date: 2026-07-03
Owner role: Integration validator

## IPS Chain

Vision -> Aukro marketplace purchase history can improve Catalog order-affinity relations without leaking buyer, address, payment, provider, token, credential, or raw marketplace payload data.
Goal Impact -> The previously empty Aukro replay path now has a non-sensitive synthetic fixture proving Marketing can parse and aggregate Aukro replay envelopes end to end.
System -> Aukro owns the protected replay source; Marketing owns aggregation and dry-run ledger evidence; Catalog remains durable relation owner.
Feature -> Synthetic `sourceOwner=aukro-service`, `channel=aukro` dry-run through `backfill:order-affinity`.
Task -> Insert one approved synthetic local Aukro order fixture with two Catalog product ids, then run protected endpoint and Marketing dry-run validation.
Execution Plan -> Approved synthetic fixture only; no live publish, no Catalog mutation, no customer/contact/address/payment/provider data, no raw replay payload logging, no marketplace mutation.
Coding Prompt -> Keep fixture visibly synthetic and bounded; print aggregate counts and candidate summaries only.
Code -> [MISSING: no Marketing source change in this validation step].
Validation -> Commands below.
State Update -> Aukro synthetic replay evidence is non-empty and Marketing dry-run passed with two directed order-affinity pairs.

## Fixture Boundary

The inserted Aukro local order uses stable synthetic identifiers only:

- `aukroOrderId=synthetic-order-affinity-20260703-001`
- `status=paid`
- `currency=CZK`
- no customer email
- no customer phone
- `forwarded=false`
- `rawData.fixture=goal24-order-affinity-synthetic-v1`
- two synthetic Catalog product ids in `rawData.items[]`

## Validation Evidence

- DB prerequisite check found active Aukro accounts and no existing fixture with `aukroOrderId=synthetic-order-affinity-20260703-001`.
- Synthetic fixture upsert returned `synthetic_fixture_rows=1`.
- Protected prefixed endpoint probe from Marketing pod returned HTTP 200, `success=true`, `count=1`, `events=1`, `contract=marketplace.order_affinity_candidate.v1`, `sourceOwner=aukro-service`, `channel=aukro`.
- Marketing CLI dry-run command: `node dist/order-affinity-backfill.js --marketplace-url http://aukro-service:3700 --source-owner aukro-service --channel aukro --run-id synthetic-aukro-affinity-20260703-001 --limit 50 --dry-run --pretty`.
- Dry-run result: `inputRecords=1`, `acceptedCreatedEvents=1`, `rejectedRecords=0`, `skippedEvents=0`, `aggregatePairs=2`, `totalPairEvidence=2`, `byChannel.aukro=1`, `ledger.status=dry_run_passed`, `ledgerRecord.status=recorded`, `idempotencyKeyCount=1`.

## Boundary Decisions

No live `--publish`, Catalog write, schedule unsuspend, DB migration, secret value output, raw replay payload output, customer/contact/address/payment/provider output, or marketplace mutation was run.

## Owner Decision

The owner approved keeping `synthetic-order-affinity-20260703-001` in the Aukro local order projection as a stable, non-sensitive replay fixture for repeatable Marketing/Aukro validation. It must remain excluded from live publish decisions unless a future owner-approved cleanup or fixture-retention policy changes this decision.

## Remaining Blockers

- `[RESOLVED: owner approved keeping synthetic Aukro fixture synthetic-order-affinity-20260703-001 for repeatable validation]`
- `[MISSING: real non-synthetic Aukro multi-Catalog-product replay evidence]`
- `[MISSING: owner-approved Aukro source/window recurring schedule activation policy]`
