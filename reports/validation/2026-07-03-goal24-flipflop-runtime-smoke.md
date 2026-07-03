# Goal 24 FlipFlop Runtime Smoke And Activation Policy

Date: 2026-07-03

## Scope

Marketing docs/status reconciliation after FlipFlop protected replay runtime evidence. Runtime checks were dry-run and aggregate-only. No CronJob was enabled, no Catalog publish or replace-window call was made, no product relation rows were changed, and no token values, raw order ids, customer/address/payment/provider data, raw payloads, event item payloads, or Catalog relation payloads were printed.

## Intent Preservation Chain

- Vision: FlipFlop purchase history can improve Catalog order-affinity while preserving service ownership and sensitive-data boundaries.
- Goal Impact: the deployed FlipFlop replay endpoint/runtime smoke blocker is resolved, and activation is now governed by an explicit conservative policy.
- System: FlipFlop owns protected replay production; Marketing owns parser, dry-run aggregation, ledger evidence, and scheduler choice; Catalog owns relation persistence.
- Feature: protected FlipFlop marketplace replay dry-run through Marketing.
- Task: verify deployed endpoint and Marketing dry-run without publishing or scheduling.
- Execution Plan: aggregate-only probe, no schedule activation, no publish, no replacement, no secret/raw payload output.
- Coding Prompt: print counts and statuses only.
- Code: Marketing docs/status/report updates only.
- Validation: `git diff --check` plus runtime evidence listed below.

## Runtime Evidence

- FlipFlop `main` at `60a1090` records the runtime smoke branch merge.
- Deployed `flipflop-order-service` was ready as `1/1/1`.
- Direct protected endpoint probe from the Marketing pod returned HTTP 200, `success=true`, contract `marketplace.order_affinity_replay_candidates.v1`, `sourceOwner=flipflop-service`, `consumerOwner=marketing-microservice`, `channel=flipflop`, `count=1`, and `events=1`.
- Sanitized Marketing CLI dry-run `goal24-flipflop-runtime-smoke-20260703-001` returned `inputRecords=1`, `acceptedCreatedEvents=1`, `rejectedRecords=0`, `skippedEvents=0`, `aggregatePairs=2`, `totalPairEvidence=2`, `byChannel.flipflop=1`, `ledger.status=dry_run_passed`, `ledgerRecord.status=recorded`, `idempotencyKeyCount=1`, and `catalogPublishMode=batch`. Because the run was dry-run, no Catalog publish occurred.

## Activation Policy

Owner-approved conservative FlipFlop marketplace replay activation policy for this Goal 24 stage:

- FlipFlop marketplace replay may be used for manual owner-run aggregate dry-runs.
- No recurring FlipFlop marketplace CronJob is approved by this step.
- No live publish, replace-window publish, schedule unsuspend, or Catalog relation mutation is approved by this step.
- Any future recurring publish or replace-window activation must name the exact `sourceOwner=flipflop-service`, `channel=flipflop`, source/window, cadence, ledger mode, publish mode, and rollback/disable plan.

## Resolved Blockers

- `[RESOLVED: deployed FlipFlop replay endpoint/runtime smoke]`
- `[RESOLVED: owner-approved conservative FlipFlop marketplace replay activation policy - no recurring marketplace CronJob, publish, or replace-window activation without future explicit source/window approval]`

## Remaining Blocker

- `[MISSING: owner-approved FlipFlop recurring marketplace publish/replace-window schedule activation]`

## Boundary Decision

No Marketing source code, migrations, Kubernetes manifests, deployment scripts, secrets, Catalog source, Catalog relation payloads, Orders, Warehouse, Payments, marketplace publication, or destructive operation was changed.
