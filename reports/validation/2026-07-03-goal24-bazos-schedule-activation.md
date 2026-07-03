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
- Schedule: `50 21 * * *` with `Europe/Prague` timezone after owner request to observe the same-day natural run.
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

- Source commit `bcc8a59` changed `marketing-order-affinity-bazos-daily` to `50 21 * * *` Europe/Prague and was pushed to `origin/main`.
- `git diff --check` passed.
- Kubernetes server-side dry-run passed; applying `k8s/order-affinity-cronjob.yaml` configured the live Bazos CronJob without changing Allegro/Aukro semantics.
- Live CronJob readback after the natural run: `schedule=50 21 * * *`, `timezone=Europe/Prague`, `suspend=false`, `lastScheduleTime=2026-07-03T19:50:00Z`, `lastSuccessfulTime=2026-07-03T19:50:30Z`.
- Natural Job `marketing-order-affinity-bazos-daily-29718470` completed successfully as a Kubernetes Job.
- Aggregate CLI output reported `mode=publish`, `inputRecords=0`, `acceptedCreatedEvents=0`, `aggregatePairs=0`, `totalPairEvidence=0`, `publish.status=skipped_no_candidates`, `candidateCount=0`, `batchCount=0`, and `ledgerRecord.status=recorded`.
- Ledger row `order-affinity:bazos-service:bazos:daily:20260702T000000Z:20260703T000000Z` remained `status=failed`, `batch_count=0`, `complete_snapshot=false`; no Catalog relation publish occurred.

## Remaining Gates

- `[MISSING: owner-reviewed future replace-window activation for Bazos]`.
- `[RESOLVED: scheduled Bazos CronJob aggregate result after first natural run observed with zero candidates and no Catalog publish]`.
