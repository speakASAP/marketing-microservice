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
- Schedule: `10 15 * * *` with `Europe/Prague` timezone.
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

Pending deploy/readback.

## Remaining Gates

- `[MISSING: owner-reviewed future replace-window activation for Bazos]`.
- `[MISSING: scheduled Bazos CronJob aggregate result after first natural run]`.
