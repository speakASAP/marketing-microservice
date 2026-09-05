# VAL-GOAL-24 Order Affinity Run Ledger

Date: 2026-07-03
Repo: marketing-microservice
Branch: codex/goal24-order-affinity-ledger
Scope: W3 source-only durable run ledger and dry-run-first idempotency registry for order-affinity backfill.

## Intent Preservation Chain

- Vision: marketplace and order purchase history can improve Catalog product relations without copying buyer, address, payment, provider, token, or raw order payload data.
- Goal Impact: Marketing can prove replay batches are bounded, repeatable, and auditable before any live Catalog mutation window.
- System: Marketing owns affinity signal aggregation and run evidence; Catalog remains durable product-relation owner; Orders and marketplace producers remain event/replay owners.
- Feature: opt-in order-affinity run ledger plus Catalog batch idempotency-key registry.
- Task: add source-only ledger construction, guarded persistence, migration, CLI output, tests, and contract documentation.
- Execution Plan: implement in Marketing only; keep ledger DB writes disabled unless explicitly enabled; do not deploy or mutate live storage.
- Coding Prompt: fail closed when ledger config is missing, expose only aggregate-safe metadata, and keep Catalog publisher guard unchanged.
- Code: `src/order-affinity-ledger.ts`, `src/order-affinity-backfill.ts`, `migrations/0013_order_affinity_run_ledger.sql`, `test/order-affinity-backfill.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`.
- Validation: targeted tests, full test suite, build, and diff check passed remotely on alfares.

## Validation Evidence

```bash
npx tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts
```

Result: PASS, 23/23 tests.

```bash
npm run build
```

Result: PASS, `tsc -p tsconfig.json && node scripts/copy-public.mjs` completed successfully.

```bash
npm test
```

Result: PASS, 99/99 tests. The suite emitted expected test-fixture audit-log DNS warnings for logging-microservice, but exited 0.

```bash
git diff --check
```

Result: PASS, no whitespace errors.

## Safety Notes

- `ORDER_AFFINITY_RUN_LEDGER_ENABLED=true` is required before ledger DB writes run.
- Without the opt-in flag, CLI output includes the planned ledger and returns `ledger_disabled` without storage mutation.
- Ledger rows store aggregate counts, source/window/cursor metadata, rejection/channel maps, and idempotency keys only.
- Raw order ids, customer/contact/address/payment/provider payloads, tokens, credentials, marketplace JSON, and raw events remain forbidden from ledger storage.
- No deployment, live DB migration, live replay, or Catalog mutation was run during this validation.

## Remaining Blockers

- `[MISSING: scheduled dry-run matrix across Allegro, Aukro, Bazos, FlipFlop, and central Orders]`
- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`

## 2026-07-03 Complete Snapshot Proof Amendment

Intent Preservation Chain: Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation -> State Update.

- Vision: marketplace and order purchase history can refresh Catalog order-affinity relations without exposing buyer, address, payment, provider, token, or raw order payload data.
- Goal Impact: Catalog `replace-window` calls now require Marketing-owned durable complete source/window proof instead of trusting a transient CLI flag.
- System: Marketing owns the run ledger, source/window metadata, idempotency keys, and publish-mode gate; Catalog owns relation persistence and exact-window replacement.
- Feature: `completeSnapshot` proof on `marketing_order_affinity_runs` and replace-window gating from the ledger entry.
- Task: persist `complete_snapshot`, include `completeSnapshot` in aggregate-only CLI ledger output, block replace-window when ledger proof is absent, and validate tests/build/diff.
- Execution Plan: source/tests/docs only in Marketing; no deploy, live DB migration, Catalog publish, raw replay output, or secret output.
- Coding Prompt: dry-run remains non-mutating; replace-window must fail closed without durable complete source/window proof plus owner retention policy reference.
- Code: `src/order-affinity-ledger.ts`, `src/order-affinity-backfill.ts`, `migrations/0013_order_affinity_run_ledger.sql`, `test/order-affinity-backfill.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`.
- Validation: focused affinity tests, build, and diff check passed on `alfares`.
- State Update: `[RESOLVED: Marketing durable run ledger proving a complete source/window snapshot at source level]`; runtime still needs deployment/migration before live use.

Validation evidence:

```bash
npx tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts
```

Result: PASS, 29/29 tests.

```bash
npm run build
```

Result: PASS, `tsc -p tsconfig.json && node scripts/copy-public.mjs` completed successfully.

```bash
git diff --check
```

Result: PASS, no whitespace errors.

Remaining blockers:

- `[RESOLVED: deploy/apply updated Marketing ledger migration containing complete_snapshot]`
- `[MISSING: producer completeness guarantees for Aukro/Bazos replay endpoints]`
- `[MISSING: owner-approved source/window for any future replace-window publish]`

## 2026-07-03 Runtime Complete Snapshot Deployment And Smoke

Intent Preservation Chain: Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation -> State Update.

- Vision: recurring product-relation replacement needs durable complete source/window proof without exposing buyer, address, payment, provider, token, raw replay payload, or raw Catalog relation data.
- Goal Impact: the runtime blocker for deploying/applying `complete_snapshot` on `marketing_order_affinity_runs` is resolved.
- System: Marketing owns aggregate ledger evidence and publish-mode gates; Catalog remains the only durable product-relation writer.
- Feature: deployed completeSnapshot ledger proof and replace-window publish guard.
- Task: validate source, deploy current `main`, confirm live schema, record aggregate-only completeSnapshot dry-run ledger evidence, and prove replace-window publish remains fail-closed without owner retention policy.
- Execution Plan: use owner approval from W2 worker thread `019f268e-bf2c-7171-a545-bc810c99111d`; no raw replay payloads, raw order ids, customer/address/payment/provider data, token values, or Catalog relation payloads; no Catalog publish.
- Coding Prompt: print aggregate counts and key presence only.
- Code: deployed existing Marketing `main` commit `0aa47ed`; documentation/status update only after runtime smoke.
- Validation: focused tests/build/diff/deploy/schema/runtime smoke passed.
- State Update: `[RESOLVED: deploy/apply updated Marketing ledger migration containing complete_snapshot]`.

Validation evidence:

```bash
npx tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts
```

Result: PASS, 30/30 tests.

```bash
npm run build
```

Result: PASS, `tsc -p tsconfig.json && node scripts/copy-public.mjs`.

```bash
git diff --check
```

Result: PASS.

```bash
./scripts/deploy.sh
```

Result: PASS, deployed image `localhost:5000/marketing-microservice:0aa47ed`; rollout completed successfully; total deployment time 60.46s.

Live schema check from `deployment/marketing-microservice`:

```json
{
  "columns": [
    {
      "column_name": "complete_snapshot",
      "data_type": "boolean",
      "column_default": "false",
      "is_nullable": "NO"
    },
    {
      "column_name": "run_id",
      "data_type": "text",
      "column_default": null,
      "is_nullable": "NO"
    }
  ],
  "counts": {
    "run_count": 9,
    "key_count": 7
  }
}
```

Aggregate-only completeSnapshot dry-run ledger smoke:

```json
{
  "runId": "goal24-complete-snapshot-smoke-20260703123503",
  "mode": "dry-run",
  "summary": {
    "inputRecords": 0,
    "acceptedCreatedEvents": 0,
    "rejectedRecords": 0,
    "skippedEvents": 0,
    "aggregatePairs": 0,
    "totalPairEvidence": 0
  },
  "ledger": {
    "sourceOwner": "allegro-service",
    "channel": "allegro",
    "windowStart": "2026-07-01T00:00:00.000Z",
    "windowEnd": "2026-07-03T00:00:00.000Z",
    "mode": "dry-run",
    "status": "dry_run_passed",
    "completeSnapshot": true,
    "batchCount": 0,
    "catalogIdempotencyKeyCount": 0
  },
  "ledgerRecord": {
    "status": "recorded",
    "runId": "goal24-complete-snapshot-smoke-20260703123503",
    "idempotencyKeyCount": 0
  },
  "publish": null
}
```

Persisted aggregate-only row verification:

```json
{
  "found": true,
  "row": {
    "run_id": "goal24-complete-snapshot-smoke-20260703123503",
    "source_owner": "allegro-service",
    "channel": "allegro",
    "mode": "dry-run",
    "status": "dry_run_passed",
    "input_records": 0,
    "accepted_created_events": 0,
    "rejected_records": 0,
    "skipped_events": 0,
    "aggregate_pairs": 0,
    "total_pair_evidence": 0,
    "batch_count": 0,
    "complete_snapshot": true,
    "idempotency_key_count": 0
  },
  "keyRows": 0
}
```

Replace-window publish guard smoke without owner retention policy:

```json
{
  "runId": "goal24-replace-window-blocked-20260703123529",
  "mode": "publish",
  "catalogPublishMode": {
    "mode": "replace-window-blocked",
    "reason": "replace_window_requires_owner_retention_policy"
  },
  "summary": {
    "inputRecords": 0,
    "acceptedCreatedEvents": 0,
    "rejectedRecords": 0,
    "skippedEvents": 0,
    "aggregatePairs": 0,
    "totalPairEvidence": 0
  },
  "publish": {
    "status": "failed",
    "reason": "replace_window_requires_owner_retention_policy",
    "candidateCount": 0,
    "batchCount": 0
  },
  "ledgerRecordPresent": false
}
```

Safety boundary:

- No Catalog publish or replace-window mutation was run.
- No raw replay payload, raw marketplace order id, raw Catalog relation payload, customer, address, payment, provider, token value, DSN, or password was printed.
- The Allegro bounded window used for the smoke returned zero current records; the purpose of this smoke was schema/ledger completeSnapshot proof, not non-empty source evidence.

Remaining blockers:

- `[MISSING: owner-approved source/window for any future replace-window publish]`
- `[MISSING: non-empty real Aukro multi-Catalog-product replay evidence]`
- `[MISSING: owner-approved Aukro source/window recurring schedule activation policy]`
- `[MISSING: Bazos paid order history source]`
- `[MISSING: Bazos persisted order item replay source]`
- `[MISSING: Bazos order item ingestion contract]`
- `[RESOLVED: deployed FlipFlop replay endpoint/runtime smoke]`
- `[RESOLVED: owner-approved conservative FlipFlop marketplace replay activation policy - no recurring marketplace CronJob, publish, or replace-window activation without future explicit source/window approval]`
- `[MISSING: owner-approved FlipFlop recurring marketplace publish/replace-window schedule activation]`
