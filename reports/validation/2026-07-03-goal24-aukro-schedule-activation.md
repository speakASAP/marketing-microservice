# Goal 24 Aukro Schedule Activation Validation

Date: 2026-07-03
Owner role: Marketing Aukro schedule/integration worker

## IPS Chain

Vision -> Aukro marketplace purchase history can improve Catalog order-affinity relations without leaking buyer, address, payment, provider, token, credential, or raw marketplace payload data.
Goal Impact -> The owner-approved Aukro validation evidence now activates the recurring Aukro ledger-gated batch publish schedule.
System -> Aukro owns protected replay source; Marketing owns aggregation, scheduling, ledger evidence, and guarded Catalog batch publish orchestration; Catalog owns durable relation rows.
Feature -> Active `marketing-order-affinity-aukro-daily` CronJob.
Task -> Unsuspend the prepared Aukro schedule using approved validation evidence, without triggering an immediate job.
Execution Plan -> Manifest and validation docs only, Kubernetes server dry-run before deploy/apply, no manual `Job` creation, no raw replay payloads, no secret output.
Coding Prompt -> Keep publish ledger-gated, batch-only, source-specific, and aggregate-safe.
Code -> `k8s/order-affinity-cronjob.yaml`, `docs/orchestrator/STATUS.md`, this validation report.
Validation -> `git diff --check`, Kubernetes server-side dry-run, deploy/apply, live CronJob readback.
State Update -> Aukro recurring schedule is owner-approved active.

## Activation Evidence

Owner-approved Aukro evidence from worker handoff:

- Contract probe from Marketing pod: `status=200`, `success=true`, `events=2`, `contract=marketplace.order_affinity_candidate.v1`.
- Dry-run run ID: `owner-approved-aukro-affinity-recheck-20260703-001`.
- Dry-run counts: `inputRecords=2`, `acceptedCreatedEvents=2`, `rejectedRecords=0`, `aggregatePairs=2`, `totalPairEvidence=4`, ledger `recorded`.
- Sanitized aggregate evidence excluding the earlier synthetic fixture: `non_synthetic_orders=2`, `eligible_status_orders=1`, `multi_item_orders=1`, `eligible_multi_item_orders=1`.

## Runtime Boundary

- The CronJob remains source-specific: `sourceOwner=aukro-service`, `channel=aukro`.
- The CronJob remains ledger-gated with `--record-ledger`, `--schedule daily`, and `--window-delay-minutes 120`.
- The CronJob uses batch publish only; it does not pass `--replace-window` and therefore does not trigger source/window pruning.
- This activation did not create an immediate Kubernetes Job and did not run a manual `--publish` command.
- Validation and status output must remain aggregate-only: no buyer, address, payment, provider, token, credential, raw order, or raw replay payload data.

## Remaining Blockers

- `[RESOLVED: owner-approved Aukro source/window recurring schedule activation policy]`.
- `[RESOLVED: non-empty Aukro multi-Catalog-product replay evidence for activation]`.
- `[MISSING: owner-reviewed future replace-window activation for Aukro]` because the active schedule is batch-publish only.
