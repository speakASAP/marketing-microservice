# VAL-GOAL-24 Affinity Dry-Run Matrix

Date: 2026-07-03
Repository: `/home/ssf/Documents/Github/marketing-microservice`
Branch: `codex/goal24-affinity-dry-run-report`
Runtime image: `localhost:5000/marketing-microservice:5637276`
Runtime readiness: `1/1` after rollout completion.

## IPS Chain

Vision -> marketplace and order purchase history can improve related-product evidence without copying buyer, address, payment provider, token, or raw order payload data into Marketing.
Goal Impact -> dry-run matrix evidence separates usable central Orders, FlipFlop, and Allegro evidence from unavailable marketplace replay producers before any live Catalog mutation window.
System -> Marketing aggregates bounded signals; Orders and marketplace services own replay sources; Catalog remains the durable relation writer.
Feature -> `backfill:order-affinity` runtime dry-run matrix and token-mapping validation.
Task -> run read-only dry-runs/fail-closed probes for central Orders, FlipFlop, Allegro, Aukro, and Bazos.
Execution Plan -> inspect token presence by name only, wait for mapped-token rollout, run `--dry-run` only, reduce outputs to aggregate counts, and avoid deployment commands, DB migration commands, live replay publishing, or Catalog writes.
Coding Prompt -> do not print secrets, raw order payloads, raw item payloads, buyer/contact/address/payment/provider data, or token values; record `[MISSING: ...]` for unavailable producer contracts.
Code -> no source code changes; validation-only docs update.
Validation -> runtime matrix commands completed from `deployment/marketing-microservice` with aggregate-only reducer output.
State Update -> central Orders, FlipFlop, and Allegro dry-run paths are usable; Aukro/Bazos producer paths remain blocked/fail-closed.

## Runtime Token Presence

Token values were not printed. After rollout to image `5637276`, Marketing reported:

## Dry-Run Matrix

Commands were run inside the Marketing pod with `node dist/order-affinity-backfill.js`, always with `--dry-run`, and output was reduced to aggregate counts before recording.

| Source | Probe | Result | Evidence |
| --- | --- | --- | --- |
| Central Orders | `--orders-url http://orders-microservice:3203` | PASS | `inputRecords=2`, `acceptedCreatedEvents=2`, `aggregatePairs=2`, `totalPairEvidence=4`, `byChannel.flipflop=2`, `ledgerRecordStatus=disabled`, `idempotencyKeyCount=1` |
| FlipFlop Orders | `--orders-url http://orders-microservice:3203 --channel flipflop` | PASS | `inputRecords=2`, `acceptedCreatedEvents=2`, `aggregatePairs=2`, `totalPairEvidence=4`, `byChannel.flipflop=2`, `ledgerRecordStatus=disabled`, `idempotencyKeyCount=1` |
| Allegro | `--marketplace-url http://allegro-service:3000` | PASS | `inputRecords=8`, `acceptedCreatedEvents=8`, `aggregatePairs=16`, `totalPairEvidence=16`, `byChannel.allegro=8`, `ledgerRecordStatus=disabled`, `idempotencyKeyCount=1` |
| Aukro | `--marketplace-url http://aukro-service:3700` | FAIL-CLOSED | HTTP 404, `[MISSING: Aukro order-affinity replay endpoint compatible with Marketing marketplace replay contract]` |
| Bazos | `--marketplace-url http://bazos-service:3000` | FAIL-CLOSED | HTTP 404, `[MISSING: Bazos order-affinity replay endpoint compatible with Marketing marketplace replay contract]` |

## Safety Boundary

- No deploy command was run by this validation worker; rollout to `5637276` was observed already in progress and completed before the final matrix.
- No live DB migration command was run.
- No `--publish` flag was used.
- No Catalog mutation was run.
- Ledger recording remained disabled: `ORDER_AFFINITY_RUN_LEDGER_ENABLED=false` and CLI output reported `ledgerRecordStatus=disabled`.
- No raw replay payloads, raw order ids, customer/contact/address/payment/provider data, or token values were printed in the evidence.
- `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true` is present at runtime, so future validation must continue to force `--dry-run` unless an owner explicitly approves a Catalog mutation window.

## Remaining Blockers

- `[MISSING: Aukro order-affinity replay endpoint compatible with Marketing marketplace replay contract]`
- `[MISSING: Bazos order-affinity replay endpoint compatible with Marketing marketplace replay contract]`
- `[MISSING: owner-approved runtime mutation window for first real Catalog batch/backfill]`
