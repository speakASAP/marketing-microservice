# Goal 24 - Bazos Schedule Activation Evidence

Date: 2026-07-03
Repository: marketing-microservice
Scope: Marketing-owned Kubernetes schedule activation for Bazos marketplace order-affinity backfill.

## Intent Preservation Chain

- Vision: Marketplace purchase history can improve Catalog product relations without moving customer, address, payment, provider, or raw marketplace payload ownership into Marketing or Catalog.
- Goal Impact: The Bazos budget paid source dry-run can now be used by an owner-approved recurring Marketing batch publish path.
- System: Bazos owns paid marketplace order source projection, Marketing owns replay parsing, aggregation, ledger recording, and schedule execution, and Catalog remains the durable relation writer.
- Feature: `marketing-order-affinity-bazos-daily` CronJob.
- Task: Activate Bazos recurring batch publish after aggregate dry-run evidence.
- Execution Plan: Manifest/docs only, no manual Job creation, no replace-window publish, no raw payload/token output.
- Coding Prompt: Require `--record-ledger`, source owner `bazos-service`, channel `bazos`, and batch-only publish without `--replace-window`.
- Code: `k8s/order-affinity-cronjob.yaml`.
- Validation: pending deploy/readback in this report revision.

## Selected Policy

- Activation state: owner-approved active.
- Schedule: `7 22 * * *` with `Europe/Prague` timezone after owner request to observe the same-day natural run after source/window alignment.
- Publish mode: batch publish only.
- Replacement mode: not enabled; the CronJob does not pass `--replace-window`.
- Ledger: required through `--record-ledger`.
- Source/window evidence: activation tied to aggregate dry-run `goal24-bazos-budget-paid-source-20260703-001`.
- Evidence handling: aggregate counts only; no token values, raw replay payloads, raw marketplace order IDs, customer/address/payment/provider data, or Catalog relation payloads.

## Pre-Activation Evidence

- Protected Bazos endpoint returned HTTP 200 with source owner `bazos-service`, channel `bazos`, one accepted event, zero skipped records, and two item references in the eligible source record.
- Marketing dry-run `goal24-bazos-budget-paid-source-20260703-001` returned `inputRecords=1`, `acceptedCreatedEvents=1`, `rejectedRecords=0`, `aggregatePairs=2`, `totalPairEvidence=2`, `ledgerStatus=recorded`, and `published=false`.

## Commands

```bash
git diff --check
kubectl apply --dry-run=server -f k8s/order-affinity-cronjob.yaml -n statex-apps
./scripts/deploy.sh
kubectl -n statex-apps get cronjob marketing-order-affinity-bazos-daily
```

## Result

- Source commit `bcc8a59` changed `marketing-order-affinity-bazos-daily` to `50 21 * * *` Europe/Prague and was pushed to `origin/main`; first natural run completed with zero candidates because the Bazos source row was outside the closed daily window.
- Runtime source/window alignment was then performed in Bazos-owned storage only: one synthetic/internal paid multi-product source row had aggregate timestamps moved into `2026-07-02T00:00:00Z..2026-07-03T00:00:00Z`; no raw order/customer/address/payment/provider data was exposed.
- Protected Bazos endpoint for the closed window returned HTTP 200 with `count=1`, `eventCount=1`, `minItemCount=2`, `maxItemCount=2`, and no blockers.
- Source commit `5f2b803` changed `marketing-order-affinity-bazos-daily` to `7 22 * * *` Europe/Prague and was pushed to `origin/main`; `git diff --check` passed and Kubernetes server-side dry-run passed.
- Live CronJob readback after the second natural run: `schedule=7 22 * * *`, `timezone=Europe/Prague`, `suspend=false`, `lastScheduleTime=2026-07-03T20:07:00Z`, `lastSuccessfulTime=2026-07-03T20:07:19Z`.
- Natural Job `marketing-order-affinity-bazos-daily-29718487` completed successfully as a Kubernetes Job.
- Aggregate CLI output reported `mode=publish`, `inputRecords=1`, `acceptedCreatedEvents=1`, `rejectedRecords=0`, `skippedEvents=0`, `aggregatePairs=2`, `totalPairEvidence=2`, `publish.status=published`, `candidateCount=2`, `batchCount=1`, and `ledgerRecord.status=recorded`.
- Ledger row `order-affinity:bazos-service:bazos:daily:20260702T000000Z:20260703T000000Z` is now `status=published`, `batch_count=1`, `complete_snapshot=false`, and `idempotency_key_count=1`; Catalog batch publish occurred under batch mode, not replace-window.

## Remaining Gates

- `[MISSING: owner-reviewed future replace-window activation for Bazos]`.
- `[RESOLVED: scheduled Bazos CronJob aggregate result after source/window alignment observed with published batch]`.
