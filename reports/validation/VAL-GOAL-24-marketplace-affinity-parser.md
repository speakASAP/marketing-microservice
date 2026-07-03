# Goal 24 Marketplace Affinity Parser Validation

Date: 2026-07-03

Intent Preservation Chain: Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation -> State Update.

- Vision: marketplace purchase history can improve related-product surfaces without moving sensitive order/customer/payment ownership into Marketing or Catalog.
- Goal Impact: Allegro-owned replay candidates can enter the existing dry-run-first order-affinity aggregation path.
- System: marketplace services produce bounded replay envelopes; Marketing normalizes and aggregates; Catalog remains the guarded relation writer.
- Feature: `marketplace.order_affinity_candidate.v1` parser support and `--marketplace-url` input.
- Task: accept bounded Allegro replay envelopes while preserving fail-closed sensitive-field rejection.
- Execution Plan: source/test/docs only; no publish, deployment, or runtime mutation.
- Coding Prompt: do not weaken canonical Orders source validation; do not store or print customer/address/payment/provider fields.
- Code: `src/order-lifecycle-events.ts`, `src/order-affinity-backfill.ts`, focused tests, and contract docs.
- Validation: focused tests, build, and diff check passed as recorded below.
- State Update: parser support is source-complete; scheduling remains blocked on durable ledger/config and owner-approved publish window.

## Blockers

- `[MISSING: durable Marketing backfill run ledger and idempotency key registry]`
- `[MISSING: runtime service token mapping from Marketing to Allegro replay endpoint]`
- `[MISSING: scheduled dry-run matrix across Allegro, Aukro, Bazos, FlipFlop, and central Orders]`


## Validation Evidence

```bash
npx tsx --test --test-concurrency=1 test/order-lifecycle-events.test.ts test/order-affinity-backfill.test.ts
```

Result: passed, 20 tests.

```bash
npm run build
```

Result: passed, `tsc -p tsconfig.json && node scripts/copy-public.mjs`.

```bash
git diff --check
```

Result: passed for the Marketing worktree.

## Boundaries

- No publish was run.
- No deployment was run.
- No live DB query or mutation was run.
- No central Orders, Warehouse, Payments, Catalog, marketplace listing, or publication mutation was run.
- No customer, buyer, address, payment provider, token, credential, raw payload, or secret value was printed.
