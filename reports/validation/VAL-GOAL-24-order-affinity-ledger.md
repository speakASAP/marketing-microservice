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

- `[MISSING: runtime Catalog internal service token secret mapping for Marketing-to-Catalog relation writes]`
- `[MISSING: scheduled dry-run matrix across Allegro, Aukro, Bazos, FlipFlop, and central Orders]`
- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`
