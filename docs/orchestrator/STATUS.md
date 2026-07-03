2026-07-03: Approved Goal 24 Marketing-to-Allegro replay token mapping prepared. IPS chain: Vision -> marketplace purchase history can improve product relations without leaking sensitive data; Goal Impact -> Marketing can authenticate to Allegro protected replay after deploy; System -> Vault/ExternalSecret-backed service-token mapping; Feature -> `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN`; Task -> map existing Allegro Vault token source into Marketing runtime; Execution Plan -> reuse `secret/prod/allegro-service` `JWT_TOKEN` without printing values; Coding Prompt -> no raw token in code/docs; Code -> `k8s/external-secret.yaml`; Validation -> pending deploy and aggregate-only dry-run; State Update -> blocker moves from missing mapping to pending runtime confirmation.

2026-07-03: Goal 24 W3 Marketing order-affinity run ledger implemented source-only. IPS chain: Vision -> purchase-history signals improve Catalog relations without copying buyer/address/payment/provider payloads; Goal Impact -> replay batches now have dry-run-first ledger evidence and idempotency keys before runtime mutation; System -> Marketing owns affinity aggregation and run evidence while Catalog remains durable relation owner; Feature -> opt-in run ledger plus Catalog batch idempotency-key registry; Task -> add guarded ledger construction/persistence, migration, CLI output, tests, and validation report; Execution Plan -> source/test/docs only, no deploy/live DB mutation; Coding Prompt -> fail closed without explicit ledger enablement and keep ledger aggregate-safe; Code -> src/order-affinity-ledger.ts, src/order-affinity-backfill.ts, migrations/0013_order_affinity_run_ledger.sql, focused tests, contract docs; Validation -> targeted order-affinity tests, full npm test, build, diff check. Remaining blockers: [MISSING: runtime Catalog internal service token secret mapping for Marketing-to-Catalog relation writes], [MISSING: scheduled dry-run matrix across Allegro, Aukro, Bazos, FlipFlop, and central Orders], [MISSING: owner-approved runtime mutation window for first real batch/backfill].

2026-07-03: Read-only Orders aggregate/count check for paid multi-product order-affinity candidates returned HTTP 200 with `count=2`, `filterLimit=200`, `paymentStatuses=[paid]`, statuses `[confirmed, processing, shipped, delivered]`, and channel summary `[flipflop]`; no customer, address, payment provider, token, raw order, or item payload data was printed.

2026-07-03: Goal 24 Marketplace affinity runtime deployed and fail-closed validation completed. IPS chain: Vision -> marketplace purchase history can improve product relations without copying sensitive order data; Goal Impact -> Marketing parser/backfill support is live but protected Allegro replay remains gated; System -> Marketing parses/aggregates while Allegro owns replay source and Catalog owns persisted relation writes; Feature -> `marketplace.order_affinity_candidate.v1` and `--marketplace-url`; Task -> deploy and validate runtime readiness; Execution Plan -> passive deploy, token-name-only presence check, fail-closed dry-run; Coding Prompt -> do not invent service-token contracts; Code -> deployed image `6ad9d3f`; Validation -> deploy passed, token mapping absent, marketplace dry-run returned HTTP 401; State Update -> add token mapping before live replay.

Blocker remains: `[MISSING: Marketing runtime token mapping for ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN or ALLEGRO_INTERNAL_SERVICE_TOKEN]`.

2026-07-03: Goal 24 W2 Marketing marketplace affinity parser support implemented source-only. IPS chain: Vision -> marketplace purchase history can improve Catalog relations without copying buyer/address/payment/provider data; Goal Impact -> Allegro-owned replay envelopes can be dry-run aggregated without temporary Orders-compatible exports; System -> Marketing owns parser/aggregation and Catalog publishing stays guarded; Feature -> `marketplace.order_affinity_candidate.v1` normalization and `--marketplace-url` backfill input; Task -> accept bounded Allegro envelopes and preserve fail-closed sensitive-field checks; Execution Plan -> source/test/docs only, no publish/deploy/runtime mutation; Coding Prompt -> do not weaken `orders-microservice` source validation for canonical Orders events; Code -> `src/order-lifecycle-events.ts`, `src/order-affinity-backfill.ts`, focused tests, contract docs; Validation -> focused parser/backfill tests, build, diff check.

## 2026-07-02 - Related Products Marketing Affinity Candidate Scorer

Current focus: continue the related-products/order-affinity implementation after Catalog relation runtime smoke passed.

Intent Preservation Chain:

- Vision: Marketing can transform bounded Orders product refs into relation candidates while Catalog remains durable product relation owner.
- Goal Impact: the ecosystem now has a deterministic source-validated bridge between `orders.order.created.v1` product evidence and future Catalog relation ingestion.
- System: Orders owns order events and order items; Marketing owns only bounded campaign/signal processing; Catalog owns persisted relation rows; Warehouse/Payments/channel services remain unchanged.
- Feature: in-memory order-affinity candidate construction.
- Task: build directed Catalog relation upsert candidates from accepted Orders created signals with at least two product refs.
- Execution Plan: Marketing repo only; no Catalog HTTP caller, DB migration, live queue/deploy change, campaign execution, or marketplace mutation.
- Coding Prompt: keep evidence bounded, deterministic, non-sensitive, and side-effect free; mark Catalog ingestion as missing.
- Code: `src/order-lifecycle-events.ts`, `test/order-lifecycle-events.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`, and `docs/orchestrator/2026-07-02-related-products-order-affinity-plan.md`.
- Validation: focused `npx tsx --test --test-concurrency=1 test/order-lifecycle-events.test.ts` passed with 11/11 tests; `npm run build -- --pretty false` passed; full `npm test` passed with 84/84 tests; `git diff --check` passed.

Implementation evidence:

- Added `buildOrderAffinityRelationCandidates` for accepted `orders.order.created.v1` signals.
- Emits deterministic directed pairs after deduplicating and sorting `catalog:product:<id>` refs.
- Candidate fields match the future Catalog batch contract: `relationType=order_affinity`, `source=marketing_order_affinity`, `score=1`, `confidence=0.5`.
- Evidence is bounded to source system/type, deterministic candidate id, optional channel/currency, product count, and reason `single_order_copurchase`.
- One-product and non-created signals emit no candidates.

Boundary decision:

- No Catalog call, no DB write, no queue binding change, no campaign execution, no deployment, no Orders/Warehouse/Payments mutation, and no marketplace publication was run.
- No customer/contact/address/payment/tracking/provider/product-title/token fields are copied into relation evidence.

Remaining blockers:

- `[MISSING: runtime Catalog internal service token secret mapping for Marketing-to-Catalog relation writes]`.
- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`.

# Marketing Orchestrator Status

## 2026-06-12

Current focus: Goal 1 - Intent Preservation And Contract Baseline.

Evidence gathered:

- Remote repository path: `/home/ssf/Documents/Github/marketing-microservice`.
- Root intent files exist: `README.md`, `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, `STATE.json`, and `AGENTS.md`.
- `docs/agents`, `docs/agents/contracts`, and `docs/agents/prompts` directories existed but were empty.
- `README.md` referenced contract files under `docs/agents/contracts`, but those files were missing.
- Existing implementation is TypeScript/Express with campaign CRUD, segment CRUD, idempotent campaign execution, consent/unsubscribe/frequency-cap checks, notification delegation through `NOTIFICATION_SERVICE_URL`, and tests under `test/executor.test.ts`.
- Existing `package.json` verification commands: `npm run build`, `npm run check`, and `npm test`.

Implementation evidence:

- Added the Intent Preservation pack under `docs/orchestrator/`.
- Updated `AGENTS.md` to make the orchestrator pack mandatory for future implementation sessions.
- Backfilled compatibility docs under `docs/agents` for the README-referenced contract paths.
- Verified README-referenced compatibility contract paths now exist.
- Remote `npm run build` passed.
- Remote `npm test` passed: 6 tests, 6 passing.

Intent Compliance Report:

- Marketing remains the campaign and segmentation control plane.
- Direct outbound delivery remains owned by notifications-microservice.
- Registered-user contact and consent ownership remains in auth-microservice.
- Lead contact and consent ownership remains in leads-microservice.
- Orders/catalog are documented as segmentation signal sources, not campaign owners.
- Real campaign execution remains documented as requiring explicit owner approval.

Completed goal:

- Goal 1 - Intent Preservation And Contract Baseline.

Next unfinished step:

- Goal 2 - External Source Integration: replace runtime stub contacts with auth/leads clients while preserving auth/leads ownership of contact and consent data.

## 2026-06-12 - Goal 2 Auth Users Client Chunk

Current focus: Goal 2 - External Source Integration.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth remains the source of truth for registered-user identity, contact data, preferred channels, fallback channels, and registered-user consent/preferences.
- Marketing reads auth-owned recipient data through the auth service and still delegates outbound delivery only to notifications-microservice.
- Real campaign execution guardrails remain unchanged; this session did not execute any real campaign against real recipients.

Implementation evidence:

- Added `src/sources.ts` as the recipient source resolver.
- `auth_users` segment execution now calls `AUTH_SERVICE_URL` using `AUTH_USERS_SEGMENT_PATH` or the default `/auth/admin/users` path when configured.
- Auth recipient mapping reads auth-owned `email`, `phone`, `preferredChannel`, `fallbackChannels`, `marketingConsents`, and unsubscribe/transactional-only indicators.
- Runtime auth source failures produce failed execution evidence with `auth_source_unavailable:*` and do not call notifications.
- Existing in-memory auth contacts remain only as an explicit fallback when `AUTH_SERVICE_URL` is not configured, preserving current tests/local behavior while removing the configured runtime dependency on hardcoded auth contacts.
- Added `AUTH_SERVICE_TOKEN` to `.env.example` as an optional key for auth bearer authentication.
- Added tests for configured auth service recipient resolution and auth source failure without notification delivery.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 8 tests, 8 passing.

Intent Compliance Report:

- Marketing did not take ownership of auth contact or consent data.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- Consent and unsubscribe decisions remain enforced before notification delegation.
- Auth API outage behavior fails safely and records evidence instead of sending.
- The max-30 notification chunk rule remains unchanged.

Completed chunk:

- Goal 2 chunk: Add auth users client for registered-user contact, preferences, and consent.

Next unfinished step:

- Goal 2 chunk: Add leads client for lead contact, preferences, and consent.

## 2026-06-12 - Goal 2 Leads Client Chunk

Current focus: Goal 2 - External Source Integration.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Leads remains the source of truth for lead identity, contact methods, preferred channels, fallback channels, marketing consent, and unsubscribe state.
- Marketing reads lead-owned recipient data through the leads service and still delegates outbound delivery only to notifications-microservice.
- Real campaign execution guardrails remain unchanged; this session did not deploy or execute any campaign against real recipients.

Implementation evidence:

- Added configured `leads` segment recipient resolution in `src/sources.ts`.
- Configured leads execution now calls `LEADS_SERVICE_URL` using `LEADS_SEGMENT_PATH` or the default `/leads` path.
- Lead recipient mapping reads lead-owned `contactMethods`, top-level contact fields, `preferredChannel`, `fallbackChannels`, `marketingConsent`, and unsubscribe indicators.
- Runtime leads source failures produce failed execution evidence with `leads_source_unavailable:*` and do not call notifications when no leads can be resolved.
- Existing in-memory lead contacts remain only as an explicit fallback when `LEADS_SERVICE_URL` is not configured, preserving current tests/local behavior while removing the configured runtime dependency on hardcoded lead contacts.
- Added `LEADS_SERVICE_TOKEN`, `LEADS_SEGMENT_PATH`, and `LEADS_SEGMENT_LIMIT` to `.env.example` as optional leads resolver configuration keys.
- Added tests for configured leads service recipient resolution and leads source failure without notification delivery.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 10 tests, 10 passing.

Intent Compliance Report:

- Marketing did not take ownership of lead contact, preference, consent, or unsubscribe data.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- Consent and unsubscribe decisions remain enforced before notification delegation.
- Leads API outage behavior fails safely and records evidence instead of sending.
- The max-30 notification chunk rule remains unchanged.

Completed chunk:

- Goal 2 chunk: Add leads client for lead contact, preferences, and consent.

Next unfinished step:

- Goal 2 chunk: Add order/catalog signal client only where segment rules require it.

## 2026-06-12 - Goal 2 Order/Catalog Signal Client Chunk

Current focus: Goal 2 - External Source Integration.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Orders remains the source of truth for order records, order items, order status, and order history signals.
- Catalog remains the source of truth for product identity, SKU, lifecycle, category, and product-readiness signals.
- Marketing reads order/catalog data only as segmentation signals and still resolves contact, preference, consent, and unsubscribe state from auth/leads before delivery.
- Marketing still delegates outbound delivery only to notifications-microservice.
- Real campaign execution guardrails remain unchanged; this session did not deploy or execute any campaign against real recipients.

Implementation evidence:

- Added read-only order signal resolution in `src/sources.ts` for `orders` segment sources.
- Orders signal calls use `ORDERS_SERVICE_URL` and `ORDER_SIGNAL_PATH` or the default `/api/orders` path when configured.
- Order signal resolution supports `orderStatus`/`status`, `orderChannel`/`channel`, direct `productId`/`sku`, and customer auth/lead/email/phone signal extraction.
- Added catalog product signal resolution only when catalog-specific segment rules require it.
- Catalog signal calls use `CATALOG_SERVICE_URL` and `CATALOG_PRODUCTS_PATH` or the default `/api/products` path, including SKU/product/list query modes.
- Order/catalog signals filter auth/leads recipients; they do not create contact records and do not bypass consent, unsubscribe, frequency-cap, or notification delegation checks.
- Runtime orders failures produce failed execution evidence with `orders_source_unavailable:*` and do not call notifications.
- Runtime catalog failures produce failed execution evidence with `catalog_source_unavailable:*` and do not call notifications.
- Added optional order/catalog resolver keys to `.env.example`: `ORDERS_SERVICE_TOKEN`, `ORDER_SIGNAL_PATH`, `ORDER_SIGNAL_LIMIT`, `CATALOG_SERVICE_URL`, `CATALOG_SERVICE_TOKEN`, `CATALOG_PRODUCTS_PATH`, and `CATALOG_PRODUCT_LIMIT`.
- Added tests for configured order/catalog signal filtering, orders API failure without notification delivery, and catalog API failure without notification delivery.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 13 tests, 13 passing.

Intent Compliance Report:

- Marketing did not take ownership of order records, product truth, contact data, preferences, consent, or unsubscribe state.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- Order/catalog APIs are used only as segmentation signal inputs.
- Consent and unsubscribe decisions remain enforced from auth/leads contact records before notification delegation.
- Orders and catalog API outage behavior fails safely and records evidence instead of sending.
- The max-30 notification chunk rule remains unchanged.

Completed chunk:

- Goal 2 chunk: Add order/catalog signal client only where segment rules require it.

Next unfinished step:

- Goal 2 chunk: Preserve in-memory test fixtures behind tests only.

## 2026-06-12 - DocsRAG Access Wiring

Current focus: operational DocsRAG/RUG access for marketing agent sessions.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- This change only enables authenticated documentation retrieval for agents; it does not alter campaign execution, recipient resolution, consent enforcement, notification delegation, or service ownership boundaries.
- No tokens or secret values were printed or stored in repository docs.

Implementation evidence:

- Checked the existing AI and RunLayer DocsRAG patterns. RunLayer uses `HOME=/home/ssf` plus a read-only `/home/ssf/.claude` mount so agents can read `~/.claude/rag-token` inside the pod.
- Verified the previous marketing pod did not have `~/.claude/rag-token` and did not expose `JWT_TOKEN` in the runtime environment.
- Updated `k8s/deployment.yaml` to set pod `securityContext` to uid/gid/fsGroup `1000`, set `HOME=/home/ssf`, and mount `/home/ssf/.claude` read-only as `claude-config`.
- Applied the deployment manifest and confirmed `deployment/marketing-microservice` rolled out successfully.
- Verified from inside `deployment/marketing-microservice` that the RAG token file is present and an authenticated Node `fetch` request to `http://docs-rag-microservice:3397/retrieval/agent-context` returns `HTTP_STATUS:200`.
- Updated `CLAUDE.md` and `AGENTS.md` to use a Node-based query command because the marketing container image does not include `curl`.

Validation:

- `kubectl apply -f k8s/deployment.yaml` passed.
- `kubectl -n statex-apps rollout status deployment/marketing-microservice --timeout=180s` passed.
- Authenticated DocsRAG retrieval from the marketing pod returned HTTP 200.
- `npm run build` and `npm test` were not run because no application source code changed.

Intent Compliance Report:

- Marketing did not take ownership of DocsRAG, AI, RunLayer, auth, leads, notifications, order, or catalog data.
- Marketing did not implement direct delivery.
- No real campaign execution was triggered.
- No secret value was committed, printed in docs, or copied into the repository.

Next unfinished step:

- Goal 2 chunk remains: Preserve in-memory test fixtures behind tests only.

## 2026-06-12 - Goal 2 Test Fixture Preservation Chunk

Current focus: Goal 2 - External Source Integration.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- In-memory recipient data is now explicitly test-only and is not a runtime fallback for missing source service configuration.
- Marketing still delegates outbound delivery only to notifications-microservice.
- Real campaign execution guardrails remain unchanged; this session did not deploy or execute any campaign against real recipients.

Implementation evidence:

- Removed the hardcoded recipient fixture export from `src/store.ts` so runtime state no longer carries stub contacts.
- Added `src/test-fixtures.ts` for deterministic test recipient fixtures.
- Updated `src/sources.ts` so missing `AUTH_SERVICE_URL` or `LEADS_SERVICE_URL` fails safely unless `NODE_ENV=test` and `MARKETING_USE_TEST_RECIPIENT_FIXTURES=true` are both set.
- Test fixture usage now logs `recipient_source_test_fixture` instead of presenting itself as a runtime fallback.
- Removed the unresolved-source fixture fallback path from recipient resolution.
- Updated tests to import fixtures from `src/test-fixtures.ts` and opt into the test-only fixture gate.
- Added a test proving disabled fixture gate plus missing auth URL produces `auth_source_unavailable:auth_service_url_missing` and no notification calls.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 14 tests, 14 passing.

Intent Compliance Report:

- Runtime execution no longer depends on hardcoded contact fixtures.
- Marketing did not take ownership of auth or leads contact, preference, consent, or unsubscribe data.
- Missing source service configuration fails safely instead of sending to fixtures.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- Consent, unsubscribe, frequency-cap, idempotency, and max-30 notification chunk behavior remain covered by tests.

Completed chunk:

- Goal 2 chunk: Preserve in-memory test fixtures behind tests only.

Next unfinished step:

- Goal 2 acceptance review: confirm all Goal 2 chunks satisfy runtime external-source integration criteria before moving to Goal 3.

## 2026-06-12 - Goal 2 Test Fixture Preservation Hardening

Current focus: Goal 2 - External Source Integration, final fixture preservation hardening.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- In-memory recipient fixtures are now stored under test code only and are not part of the production source build tree.
- Marketing still delegates outbound delivery only to notifications-microservice.
- Real campaign execution guardrails remain unchanged; this session did not deploy or execute any campaign against real recipients.

Implementation evidence:

- Deleted src/test-fixtures.ts so hardcoded recipient fixtures are no longer compiled with production source.
- Removed stale dist/test-fixtures.js generated output so the remote working tree does not retain old built fixture data.
- Added test/fixtures.ts as the deterministic test-only recipient fixture holder.
- Updated src/sources.ts to remove dynamic imports of fixture data and accept only a test-provided fixture provider guarded by NODE_ENV=test.
- Updated test/executor.test.ts to register the fixture provider from test/fixtures.ts after setting the test environment.
- Added a direct test proving fixture provider registration throws outside the test environment.

Validation:

- Remote npm run build passed after stale fixture output cleanup.
- Remote npm test passed after stale fixture output cleanup: 15 tests, 15 passing.

Intent Compliance Report:

- Runtime execution no longer contains or imports hardcoded recipient fixtures.
- Missing source service configuration still fails safely instead of sending to fixtures.
- Marketing did not take ownership of auth or leads contact, preference, consent, or unsubscribe data.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- Consent, unsubscribe, frequency-cap, idempotency, configured auth/leads source resolution, order/catalog signal filtering, and max-30 notification chunk behavior remain covered by tests.

Completed chunk:

- Goal 2 chunk: Preserve in-memory test fixtures behind tests only.

Next unfinished step:

- Goal 2 acceptance review: confirm all Goal 2 chunks satisfy runtime external-source integration criteria before moving to Goal 3.


## 2026-06-13 - Goal 2 Acceptance Review

Current focus: Goal 2 - External Source Integration acceptance review.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Orders and catalog remain segmentation signal sources only.
- Notifications remains the only outbound delivery executor.
- This review did not execute any real campaign against real recipients.

Acceptance evidence:

- Runtime recipient resolution uses configured auth and leads HTTP clients in src/sources.ts.
- Runtime hardcoded contact fixtures are absent from src/store.ts and dist; deterministic contacts live under test/fixtures.ts only.
- Test fixture usage is gated by NODE_ENV=test, MARKETING_USE_TEST_RECIPIENT_FIXTURES=true, and a test-registered provider.
- Missing or failed auth/leads/orders/catalog source calls produce failed source evidence and no notification calls when no recipients can be safely resolved.
- Order/catalog integration filters auth/leads recipients and does not create contact records or bypass consent/unsubscribe/frequency checks.
- Added missing AUTH_USERS_SEGMENT_PATH and AUTH_USERS_SEGMENT_LIMIT keys to .env.example so configured auth resolver options are documented.

Validation:

- Remote npm run build passed on 2026-06-13.
- Remote npm test passed on 2026-06-13: 15 tests, 15 passing.

Intent Compliance Report:

- Runtime execution no longer depends on hardcoded contact fixtures.
- Consent and unsubscribe decisions use source-owned auth/leads recipient data when services are configured.
- API failures fail safely with source failure evidence and do not trigger direct sending.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- The max-30 notification chunk rule remains covered by tests and unchanged in src/executor.ts.

Completed goal:

- Goal 2 - External Source Integration.

Next unfinished step:

- Goal 3 - Persistence And Execution State.

## 2026-06-13 - Goal 3 Persistence Schema And Store Chunk

Current focus: Goal 3 - Persistence And Execution State.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns persisted campaign definitions, segment definitions, execution runs, delivery outcomes, suppression evidence, idempotency keys, and frequency-cap send history.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Orders and catalog remain segmentation signal sources only.
- Notifications remains the only outbound delivery executor; this session did not add direct email, Telegram, or WhatsApp sending.
- Real campaign execution guardrails remain unchanged; this session did not execute a real campaign against real recipients.

Implementation evidence:

- Added `migrations/0001_persistence_and_execution_state.sql` with PostgreSQL tables for segments, campaigns, campaign runs, delivery outcomes, suppression evidence, idempotency keys, and send history.
- Added `pg` runtime dependency and `@types/pg` dev dependency.
- Replaced direct runtime `Map` access with a `MarketingStore` interface in `src/store.ts`.
- Added `InMemoryMarketingStore` to preserve isolated test/local state and existing reset helpers.
- Added `PostgresMarketingStore` backed by PostgreSQL and enabled by `MARKETING_STORE=postgres`, `DATABASE_URL`, or `DB_HOST` plus `DB_NAME`.
- Store initialization can apply the migration when `DB_AUTO_CREATE=true` or `DB_SYNC=true`.
- Updated `src/executor.ts` so campaign/segment lookup, idempotency lookup, running/completed execution state, outcomes, suppression evidence, and send history are written through the active store.
- Updated `src/main.ts` so segment CRUD, campaign CRUD, and execution listing use the active store.
- Added `MARKETING_STORE` and `DATABASE_URL` to `.env.example`.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 15 tests, 15 passing.
- Remote PostgreSQL smoke test passed against temporary `postgres:16-alpine` container on 2026-06-13:
  - migration applied through `DB_AUTO_CREATE=true`;
  - segment and campaign records were saved and read through a fresh store instance;
  - idempotency key lookup returned the persisted run across store instances;
  - sent, skipped, and failed delivery outcomes persisted;
  - send history persisted for frequency-cap decisions.

Intent Compliance Report:

- Persistence was added only for Marketing-owned orchestration and audit state.
- Marketing did not duplicate auth/leads contact or consent ownership.
- Marketing did not take ownership of order/catalog records or product truth.
- Marketing did not implement direct delivery or provider credentials.
- Consent, unsubscribe, frequency-cap, source-failure safety, and max-30 notification chunk behavior remain covered by tests.

Completed chunk:

- Goal 3 chunk: Add PostgreSQL schema/migrations for segments, campaigns, runs, outcomes, suppression, and idempotency keys.
- Goal 3 chunk: Replace in-memory maps with repository interfaces backed by PostgreSQL.
- Goal 3 chunk: Preserve test reset helpers using isolated test stores.

Next unfinished step:

- Goal 3 acceptance review: confirm campaign CRUD and execution state persistence across restart-style PostgreSQL store instances before moving to Goal 4.

## 2026-06-13 - Goal 3 Acceptance Review

Current focus: Goal 3 - Persistence And Execution State acceptance review.

Acceptance evidence:

- Campaign CRUD uses the active `MarketingStore` and persists through `PostgresMarketingStore` when PostgreSQL configuration is present.
- Execution state is saved when a run starts and after it completes, including delivery outcomes and totals.
- Idempotency keys are persisted in `marketing_idempotency_keys` and resolved through `findRunByIdempotency` across fresh PostgreSQL store instances.
- Delivery outcomes persist sent, skipped, and failed evidence; skipped and failed outcomes also write suppression evidence.
- Frequency-cap send history persists in `marketing_send_history` and is read by execution before delivery decisions.
- Test reset behavior remains isolated through `resetInMemoryState` and the in-memory store path.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 15 tests, 15 passing.
- Remote PostgreSQL restart-style smoke test passed on 2026-06-13 using a temporary `postgres:16-alpine` container.

Intent Compliance Report:

- Goal 3 persisted only Marketing-owned campaign, segment, run, outcome, suppression, idempotency, and send-history state.
- Contact data and consent remain externally owned by auth/leads.
- Order/catalog data remains segmentation signal input only.
- Notifications remains the sole delivery executor.
- No real campaign was executed against real recipients.

Completed goal:

- Goal 3 - Persistence And Execution State.

Next unfinished step:

- Goal 4 - Campaign Approval And Safety Gates.

## 2026-06-13 - Goal 4 Campaign Approval And Safety Gates

Current focus: Goal 4 - Campaign Approval And Safety Gates.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns campaign approval state, approval actor metadata, execution dry-run state, safety guardrails, and run approval evidence.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Orders and catalog remain segmentation signal sources only.
- Notifications remains the only outbound delivery executor; dry-run and blocked executions do not call notifications.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added campaign approval fields to `src/types.ts`: `approvalStatus`, `approvedBy`, `approvedAt`, and `approvalNote`.
- Added run-level `dryRun` and `approvalEvidence` fields so real executions preserve the approval state that authorized that run.
- Added `migrations/0002_campaign_approval_safety.sql` for campaign approval columns and run approval/dry-run columns.
- Updated `PostgresMarketingStore` to apply all sorted SQL migrations and persist campaign approval metadata plus run approval evidence.
- Campaign creation now defaults to `approvalStatus: pending`.
- Campaign updates no longer silently mutate approval metadata.
- Added `POST /campaigns/:id/approve` requiring `approvedBy` or `x-owner-actor` and setting approval metadata.
- Real execution now rejects unapproved campaigns and draft/paused/archived/failed campaigns before recipient delivery work.
- Added dry-run mode through `POST /campaigns/:id/dry-run` and `POST /campaigns/:id/execute` with `dryRun: true`.
- Dry-run resolves recipients, consent/unsubscribe/frequency decisions, effective channels, and would-send outcomes without notification calls or send-history writes.
- Max sends per run now fails clearly with `max_send_per_run_exceeded:<approvedCount>><maxSendPerRun>` and no notification calls instead of silently truncating recipients.
- Configured notification chunk size above the platform max fails clearly with `notification_chunk_size_exceeds_platform_limit:<configured>>30` and no notification calls.
- Added `CAMPAIGN_NOTIFICATION_CHUNK_SIZE` to `.env.example`.
- Updated local contract docs for approval and dry-run API surface.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 19 tests, 19 passing.
- Remote PostgreSQL smoke test passed against temporary `postgres:16-alpine` container on 2026-06-13:
  - migrations `0001` and `0002` applied through `DB_AUTO_CREATE=true`;
  - approved campaign metadata persisted and read through a fresh store instance;
  - real run approval evidence persisted and read through idempotency lookup;
  - dry-run run state and `would_send` outcome persisted and read through idempotency lookup.

Intent Compliance Report:

- Goal 4 added owner approval enforcement without moving contact, consent, order, catalog, or provider ownership into marketing.
- Marketing still does not send directly; real delivery remains delegated only to notifications-microservice.
- Draft and unapproved campaigns cannot execute against real recipients.
- Dry-run produces decision evidence without notification calls.
- Consent, unsubscribe, frequency-cap, source-failure safety, idempotency, max-send, and max-30 chunk behavior are covered by tests.

Completed goal:

- Goal 4 - Campaign Approval And Safety Gates.

Next unfinished step:

- Goal 5 - Scheduling, Throttling, And Frequency Controls.

## 2026-06-13 - Goal 5 Scheduling, Throttling, And Frequency Controls Start

Current focus: Goal 5 - Scheduling, Throttling, And Frequency Controls.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns scheduler claim state, run idempotency, throttle policy, frequency-cap enforcement, and campaign/run visibility state.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Orders and catalog remain segmentation signal sources only.
- Notifications remains the only outbound delivery executor; scheduler execution still delegates through notifications-microservice and never sends directly.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added scheduler lock metadata to campaigns: scheduler owner, lock expiry, and last scheduled run timestamp.
- Added migration `migrations/0003_scheduling_throttling_frequency_controls.sql` for scheduler lock persistence and due-schedule indexes.
- Added store-level due campaign claiming with PostgreSQL `for update skip locked` semantics and in-memory test-store equivalent behavior.
- Added `src/scheduler.ts` with `runDueScheduledCampaigns`, deterministic scheduled-run idempotency keys, lock TTL, batch size, and scheduler owner options.
- Added `POST /scheduler/run-due` for explicit operational scheduler invocation.
- Scheduled execution only claims approved, scheduled, due campaigns with no active lock and no matching completed `lastScheduledRunAt`.
- Paused campaigns are not claimed and do not execute through the scheduler.
- Added campaign throttle pacing so `throttlePerMinute` spaces notification requests while preserving the max-30 chunk guardrail.
- Frequency caps continue to use persisted send history before notification delegation.
- Added scheduler environment keys to `.env.example`: `CAMPAIGN_SCHEDULER_OWNER`, `CAMPAIGN_SCHEDULER_BATCH_SIZE`, and `CAMPAIGN_SCHEDULER_LOCK_TTL_MS`.
- Added tests for duplicate scheduler prevention, paused scheduler skips, and throttle pacing.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 22 tests, 22 passing.

Intent Compliance Report:

- Goal 5 scheduling work did not move delivery into marketing; notifications remains the only delivery executor.
- Scheduler execution still goes through existing approval, consent, unsubscribe, frequency-cap, max-send, and max-30 chunk checks.
- Scheduler locks and scheduled-run markers are Marketing-owned execution safety state.
- Contact, consent, order, catalog, and provider ownership boundaries remain unchanged.
- Recurring campaigns were not added because the owner did not explicitly require them.

Completed chunk:

- Goal 5 chunk: Add scheduler ownership and locking rules.
- Goal 5 chunk: Implement per-campaign throttle and persisted frequency-cap enforcement.
- Goal 5 chunk: Add operational visibility for scheduled execution through campaign/run status and explicit scheduler result output.

Next unfinished step:

- Goal 5 acceptance review: confirm the scheduling/throttling implementation satisfies all Goal 5 acceptance criteria before moving to Goal 6.

## 2026-06-13 - Goal 5 Acceptance Review

Current focus: Goal 5 - Scheduling, Throttling, And Frequency Controls acceptance review.

Acceptance evidence:

- Duplicate schedulers cannot double-send the same scheduled run: due campaign claiming stores scheduler owner and lock expiry, PostgreSQL uses `for update skip locked`, scheduled executions use deterministic idempotency keys, and the test `scheduler claim prevents duplicate due scheduled execution` proves a second scheduler claim sends nothing.
- Frequency caps are enforced across persisted history: execution reads send history through `MarketingStore.getSendHistory` before notification delegation, PostgreSQL persists send history in `marketing_send_history`, and existing frequency-cap tests continue to pass.
- Paused campaigns do not execute: manual execution rejects paused campaigns and scheduler claiming filters to `status = scheduled`; the test `scheduler does not execute paused campaigns` verifies no notification call is made.
- Per-campaign throttling is active: `throttlePerMinute` spaces notification requests, with test coverage through `applies campaign throttle between notification sends`.
- Operational visibility is available through campaign status, execution run status, `GET /campaigns`, `GET /executions`, and explicit `POST /scheduler/run-due` result output.
- Recurring campaigns were not added because the Goal 5 prompt requires them only if explicitly requested by the owner.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 22 tests, 22 passing.

Intent Compliance Report:

- Goal 5 completed Marketing-owned scheduling, throttling, frequency-cap, and run-state controls only.
- Marketing did not implement direct email, Telegram, or WhatsApp delivery.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Orders and catalog remain segmentation signal sources only.
- Scheduler execution still requires campaign approval and enforces consent, unsubscribe, frequency caps, max-send, and max-30 chunk rules before notification delegation.
- No real campaign was executed against real recipients.

Completed goal:

- Goal 5 - Scheduling, Throttling, And Frequency Controls.

Next unfinished step:

- Goal 6 - Audit Logging And Compliance Evidence.

## 2026-06-13 - Goal 6 Audit Logging And Compliance Evidence Start

Current focus: Goal 6 - Audit Logging And Compliance Evidence.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns audit evidence for campaign creation, update, approval, execution, scheduler decisions, recipient decisions, and notification delegation outcomes.
- Notifications remains the only outbound delivery executor; Marketing only adds correlation metadata to delegated notification requests.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Orders and catalog remain segmentation signal sources only.
- No real campaign was executed against real recipients.

Implementation evidence:

- Reworked `src/logger.ts` into a centralized audit logger that emits structured JSON with ISO timestamp, service name, and `duration_ms` on every `logDecision` event.
- Added sanitization for sensitive keys including tokens, authorization, credentials, secrets, message bodies, and recipient addresses before stdout emission or logging-service forwarding.
- Added optional forwarding to `LOGGING_SERVICE_URL` using `LOGGING_SERVICE_PATH` or default `/logs`, with optional `LOGGING_SERVICE_TOKEN` bearer auth.
- Added test-only audit sink for deterministic logger validation without relying on a live logging service.
- Added API audit events for segment create/update/delete and campaign create/update/approval/delete/manual execution/dry-run/scheduler invocation.
- Added cross-service notification correlation IDs through the `x-correlation-id` header.
- Added `correlationId` to delivery outcomes and persisted it in `marketing_delivery_outcomes.correlation_id` through `migrations/0004_audit_logging_compliance.sql`.
- Updated `.env.example` with `LOGGING_SERVICE_TOKEN` and `LOGGING_SERVICE_PATH` keys.
- Updated the marketing campaign contract with the audit logging contract.
- Added tests for audit sanitization, logging-service forwarding, and notification correlation headers.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 24 tests, 24 passing.

Intent Compliance Report:

- Goal 6 changes add audit evidence only; they do not move provider execution, credentials, or channel registry behavior into Marketing.
- Marketing still delegates all delivery to notifications-microservice.
- Audit payloads redact sensitive message, token, authorization, credential, secret, and recipient-address fields before forwarding.
- Consent, unsubscribe, frequency-cap, approval, max-send, and max-30 chunk checks remain in the execution path before notification delegation.
- Contact, consent, order, catalog, and provider ownership boundaries remain unchanged.

Completed chunk:

- Goal 6 chunk: Send structured logs to logging-microservice where available.
- Goal 6 chunk: Add audit fields/events for campaign create/update/approval/execution.
- Goal 6 chunk: Record consent-decision evidence without exposing secrets.
- Goal 6 chunk: Add correlation IDs for cross-service notification calls.

Next unfinished step:

- Goal 6 acceptance review: confirm audit evidence can explain every sent, skipped, or failed recipient and that no sensitive payloads are logged before moving to Goal 7.

## 2026-06-13 - Goal 6 Acceptance Review

Current focus: Goal 6 - Audit Logging And Compliance Evidence acceptance review.

Acceptance evidence:

- Logs include ISO timestamp and duration_ms where relevant: the centralized audit logger adds ISO timestamp, service, and duration_ms to every logDecision payload, and execution, API, scheduler, source-resolution, guardrail, notification chunk, and completion events use it.
- Campaign execution can explain every sent, skipped, or failed recipient: execution persists per-recipient DeliveryResult rows with status, decisionReason, requested/effective channels, processedAt, duration_ms, and correlationId where notification delegation is attempted; completion logs include statusCounts and reasonCounts.
- No sensitive tokens or message secrets are logged: audit sanitization redacts keys matching token, authorization, password, secret, credential, message/body, and recipient address before stdout or logging-service forwarding; tests verify redaction and forwarding behavior.
- Cross-service notification traceability is present: notification calls include x-correlation-id and delivery outcomes persist the matching correlationId through migration 0004_audit_logging_compliance.sql.
- Logging-microservice integration is optional and safe: LOGGING_SERVICE_URL enables sanitized forwarding to LOGGING_SERVICE_PATH or /logs with optional bearer auth; forwarding failure is reported without exposing secrets or blocking execution.

Validation:

- Remote npm run build passed on 2026-06-13.
- Remote npm test passed on 2026-06-13: 24 tests, 24 passing.

Intent Compliance Report:

- Goal 6 added audit evidence and traceability only; it did not move provider execution, channel registry behavior, contact ownership, consent ownership, order ownership, or catalog ownership into Marketing.
- Marketing still delegates all outbound delivery to notifications-microservice and never sends email, Telegram, or WhatsApp directly.
- Consent, unsubscribe, frequency-cap, approval, max-send, and max-30 chunk checks remain enforced before notification delegation.
- Audit payloads avoid message bodies, recipient addresses, tokens, authorization headers, credentials, and other secret material.
- No real campaign was executed against real recipients.

Completed goal:

- Goal 6 - Audit Logging And Compliance Evidence.

Next unfinished step:

- Goal 7 - API Contract Hardening.

## 2026-06-13 - Goal 7 API Contract Hardening

Current focus: Goal 7 - API Contract Hardening.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns campaign, segment, execution, dry-run, scheduler, and audit API contracts only.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Notifications remains the only outbound delivery executor; no direct delivery was added.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `src/api-contracts.ts` with shared request validators, stable contract error responses, enum validation, ISO schedule validation, idempotency validation, source-owner validation, and service-token authorization middleware.
- Protected write and execution routes now require `Authorization: Bearer <token>` or `x-service-token` backed by `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`.
- Segment APIs validate required fields, source types, rules shape, boolean flags, read-only IDs, and estimated count values before mutation.
- Campaign APIs validate required fields, channel names, purposes, statuses, schedule values, positive limits, message shape, read-only IDs, and read-only approval fields before mutation.
- Real execution now has a stable idempotency request contract before executor invocation.
- Added public preference/unsubscribe contract endpoints that return auth/leads source ownership metadata and do not write contact or consent truth inside Marketing.
- Exported the Express app for contract tests while preserving the existing runtime startup path.
- Added `MARKETING_API_TOKEN` and `SERVICE_API_TOKEN` keys to `.env.example`.
- Updated contract docs for API authorization/validation and source-owned preference/unsubscribe behavior.
- Added `test/api-contracts.test.ts` covering protected writes, invalid segment/campaign validation, real execution idempotency validation, and public preference/unsubscribe ownership responses.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 28 tests, 28 passing.

Intent Compliance Report:

- Goal 7 stabilized API boundaries without moving delivery, contact ownership, consent ownership, order ownership, catalog ownership, provider credentials, or channel registry behavior into Marketing.
- Marketing still delegates all outbound delivery to notifications-microservice.
- Public preference/unsubscribe endpoints preserve auth/leads as write owners and only expose contract/ownership metadata plus sanitized audit evidence.
- Approval, consent, unsubscribe, frequency-cap, max-send, max-30 chunking, idempotency, and audit controls remain in place.

Completed goal:

- Goal 7 - API Contract Hardening.

Next unfinished step:

- No remaining numbered goal is pending in `docs/orchestrator/GOALS.md`; await owner selection for the next backlog or follow-up hardening item.

## 2026-06-13 - TG-2.x Follow-Up Hardening: Protected API Runtime Token Wiring

Current focus: TG-2.x Follow-up hardening after Phase 1 validation.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- This hardening only wires runtime configuration for protected Marketing APIs.
- Auth and leads remain the sources of truth for contact data, preferences, consent, and unsubscribe state.
- Notifications remains the only outbound delivery executor.
- No real campaign was executed against real recipients.

Implementation evidence:

- Updated `k8s/external-secret.yaml` so the Kubernetes secret exposes `MARKETING_API_TOKEN` from the existing Vault `JWT_TOKEN` property.
- Updated `k8s/secret.yaml.example` to include `MARKETING_API_TOKEN`, `NOTIFICATION_SERVICE_TOKEN`, and `JWT_TOKEN` placeholders for local/manual secret creation.
- Updated `README.md` configuration guidance to document that protected write/execution APIs require `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`, with Kubernetes mapping `MARKETING_API_TOKEN` from the service secret.
- Updated `TASKS.md` to close the selected TG-2.x hardening item.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 28 tests, 28 passing.

Intent Compliance Report:

- The change does not add direct email, Telegram, or WhatsApp delivery.
- The change does not move contact, consent, unsubscribe, order, catalog, provider credential, or channel registry ownership into Marketing.
- Protected API authorization now has matching runtime secret wiring, avoiding `api_auth_not_configured` for write/execution endpoints once deployed with the updated manifests.
- No secret values were committed or printed; only secret key names and Vault property references were added.

Completed follow-up item:

- TG-2.x protected API runtime token wiring.

Next unfinished step:

- No active coordinator-maintained task remains in `TASKS.md`; await owner selection for another hardening item or deployment approval.

## 2026-06-13 - TG-3.0 Ecosystem Roadmap Created

Current focus: expanded Statex Marketing ecosystem roadmap and implementation goals.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns campaigns, segments, journeys, approvals, dry-runs, scheduled runs, delivery decisions, throttling, frequency caps, suppression decisions, attribution references, and campaign audit state.
- Auth and leads remain the sources of truth for registered users, leads, contact data, preferences, consent, and unsubscribe state.
- Notifications remains the source of truth for outbound provider execution, channel registry behavior, provider credentials, and final send execution.
- Domain/app services remain the source of truth for application behavior, orders, reservations, listings, learning progress, workflow usage, reports, products, and other segmentation signals.
- Tenant/app/business registry and CRM/account master data are explicitly kept outside Marketing.
- No real campaign was executed against real recipients.

Sub-agent evidence:

- Spawned three read-only sub-agents for ecosystem ownership, product/CRM/channel roadmap, and landing/admin implementation sequencing.
- All analyses converged on the boundary that CRM-like engagement belongs in Marketing, but CRM/account master data should be owned by a separate CRM/account service or composed console, not by Marketing.
- Frontend/admin analysis confirmed the current repo has no frontend and should add landing/admin auth shell before admin campaign controls.

Implementation evidence:

- Added `docs/orchestrator/ROADMAP.md` with the comprehensive ecosystem roadmap, CRM decision, application portfolio marketing model, channel strategy, landing page scope, admin dashboard scope, phases, Goal 8 through Goal 20 backlog, and validation strategy.
- Expanded `docs/orchestrator/GOALS.md` with pending Goals 8-20.
- Replaced `docs/orchestrator/PLAN.md` with the Phase 2+ implementation plan and next goal selection.
- Appended Goal 8-20 prompts to `docs/orchestrator/PROMPTS.md`.
- Updated `TASKS.md` with TG-3.1 through TG-3.13 backlog items and marked `tg-3.0-ecosystem-roadmap-created` complete.
- Updated `STATE.json` to `phase-2-roadmap-ready` with next focus `Goal 8 ecosystem ownership contract baseline`.

Validation:

- Documentation-only roadmap update; `npm run build` and `npm test` were not required because no runtime source code changed.
- Remote files were updated only under `/home/ssf/Documents/Github/marketing-microservice` on `alfares`.

Intent Compliance Report:

- The roadmap preserves Marketing as the campaign and segmentation control plane.
- The roadmap does not move direct email, Telegram, WhatsApp, provider credential, or channel registry ownership into Marketing.
- The roadmap does not move auth/leads contact, identity, consent, preference, or unsubscribe ownership into Marketing.
- The roadmap explicitly rejects implementing CRM master data inside Marketing.
- The roadmap keeps application/domain services as signal owners and prevents them from becoming campaign engines.
- The roadmap requires owner approval, consent enforcement, unsubscribe handling, frequency caps, throttling, idempotency, max-send limits, max-30 chunking, and audit evidence to remain in future campaign execution paths.

Completed follow-up item:

- TG-3.0 ecosystem roadmap created.

Next unfinished step:

- Goal 8 - Ecosystem Ownership Contract Baseline.

## 2026-06-13 - Goal 8 Ecosystem Ownership Contract Baseline

Current focus: Goal 8 - Ecosystem Ownership Contract Baseline.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing owns campaign definitions, segment definitions, journey definitions, approvals, dry-runs, scheduled runs, delivery decisions, suppression, throttling, frequency caps, attribution references, and campaign audit state.
- Auth and leads remain the sources of truth for identity, contact data, preferences, consent, and unsubscribe state.
- Notifications remains the source of truth for provider execution, provider credentials, channel registry behavior, and final sends.
- Tenant/app/business registry, CRM/account master data, analytics read models, application event truth, order truth, and catalog truth are explicitly owned outside Marketing.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/ecosystem-ownership-contract.md` with the ecosystem ownership matrix, cross-service contract changes, and safety invariants.
- Added `docs/agents/contracts/application-portfolio-taxonomy.md` with canonical app IDs and lifecycle/signal taxonomy for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.
- Added `docs/agents/contracts/crm-account-boundary-contract.md` confirming CRM/account master data does not belong inside Marketing and defining future read-only CRM/account signal usage.
- Added `docs/agents/contracts/tenant-app-registry-contract.md` defining tenant/app/business/brand/sender/locale/timezone/policy registry ownership and Marketing validation-only usage.
- Added `docs/agents/contracts/analytics-attribution-contract.md` defining Marketing campaign facts, notification delivery facts, app/domain behavior facts, and analytics/customer-insights read-model ownership.
- Added `docs/agents/contracts/application-signal-contract.md` defining a common signal envelope, subject references, and safe failure rules for app behavior signals.
- Updated `docs/agents/contracts/integration-api-matrix.md` to reference the expanded ecosystem services and new contract documents.
- Updated `docs/orchestrator/GOALS.md` to mark Goal 8 complete.
- Updated `docs/orchestrator/PLAN.md`, `TASKS.md`, and `STATE.json` so the next focus is Goal 9 - Tenant/App Registry Integration.

Validation:

- Documentation-only contract update; `npm run build` and `npm test` were not required because no runtime source code changed.
- `STATE.json` parsed successfully after update.
- Goal 8 acceptance checklist was reviewed against the new contract pack.

Intent Compliance Report:

- Marketing did not take ownership of contacts, consent truth, CRM master data, tenant truth, provider credentials, channel registry state, raw app events, order truth, or catalog truth.
- Marketing did not implement direct email, Telegram, WhatsApp, or provider delivery.
- Apps and domain services are documented as signal owners only and are not campaign engines.
- Future CRM/account service is documented as the account master owner; Marketing may consume read-only lifecycle signals only.
- The roadmap and contracts preserve owner approval, explicit consent, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunks, notification delegation, and audit evidence.

Completed goal:

- Goal 8 - Ecosystem Ownership Contract Baseline.

Next unfinished step:

- Goal 9 - Tenant/App Registry Integration.


## 2026-06-13 - Goal 9 Tenant/App Registry Integration

Current focus: Goal 9 - Tenant/App Registry Integration.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing stores canonical tenant/app/brand/business/locale/timezone/product-line/lifecycle/policy references only.
- Tenant/app/business registry truth remains outside Marketing.
- Notifications remains the only outbound delivery executor; registry validation now runs before recipient resolution and notification delegation.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added RegistryScope metadata to campaign and segment models, including required tenantId, appId, and brandId plus optional business, environment, locale/timezone, product-line, lifecycle, sender identity, and policy references.
- Added src/registry.ts registry validation client with TENANT_APP_REGISTRY_URL, optional token/path/timeout configuration, and test-only fixtures gated by NODE_ENV=test plus MARKETING_USE_TEST_REGISTRY_FIXTURES=true.
- Added registry validation to segment/campaign create/update routes and execution preflight. Real execution fails before recipient resolution/delivery on unavailable, invalid, or inactive registry references; dry-run records a safe guardrail result.
- Added tenant/app/brand scope filters for segment and campaign list endpoints.
- Added migration migrations/0005_tenant_app_registry_scope.sql to persist scope references and indexes.
- Updated contract docs, local env key template, and Kubernetes registry environment wiring.
- Added contract tests for invalid registry references and tenant/app segment filtering.

Validation:

- Remote npm run build passed on 2026-06-13.
- Remote npm test passed on 2026-06-13: 30 tests, 30 passing.

Intent Compliance Report:

- Marketing did not take ownership of tenant, app, business, brand, sender, provider credential, contact, consent, unsubscribe, order, catalog, CRM, analytics, or application event truth.
- Marketing stores registry references and validates them through the registry contract only.
- Missing or invalid registry references fail safely before notification delegation.
- Consent, unsubscribe, approval, frequency cap, throttling, idempotency, max-send, max-30 chunking, and audit controls remain in place.
- No direct email, Telegram, WhatsApp, or provider delivery was added.

Completed goal:

- Goal 9 - Tenant/App Registry Integration.

Next unfinished step:

- Goal 10 - Cross-Service Recipient And Consent Contract Hardening.


## 2026-06-13 - Goal 10.1 Auth Recipient Contract Hardening

Current focus: Goal 10 - Cross-Service Recipient And Consent Contract Hardening, chunk 10.1.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth remains the source of truth for registered-user identity, contact data, preferred channels, fallback channels, consent, and unsubscribe state.
- Marketing reads auth-owned recipient and consent data by tenant/app/purpose/channel, stores execution evidence only, and still delegates outbound delivery only to notifications-microservice.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/auth-recipient-consent-contract.md` defining the auth registered-user recipient endpoint semantics for tenantId, appId, brandId, purpose, channel, limits, response fields, channel consent semantics, pagination, safe failure behavior, and ownership boundaries.
- Updated `docs/agents/contracts/preferences-consent-contract.md` and `docs/agents/contracts/integration-api-matrix.md` to reference the auth-specific recipient/consent contract.
- Updated auth recipient source requests to always include campaign scope and delivery decision fields: tenantId, appId, brandId, purpose, channel, optional fallbackChannels, and optional registry scope filters, while preserving segment rule filters.
- Added normalized optional channel consent evidence to recipient contacts so source-owned channel denial can be enforced before notification delegation.
- Updated execution eligibility to skip marketing recipients with explicit source-owned denial for the effective delivery channel using `channel_consent_missing`.
- Extended the configured auth source test to assert scoped auth query parameters and channel-specific consent denial behavior.
- Marked Goal 10.1 complete in `docs/orchestrator/GOALS.md`; Goal 10 remains open.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 30 tests, 30 passing.

Intent Compliance Report:

- Marketing did not take ownership of auth contact, identity, preference, consent, or unsubscribe truth.
- Marketing did not implement direct email, Telegram, WhatsApp, or provider delivery.
- Source-owned channel consent denial is enforced before notification delegation.
- Auth source outages and invalid source behavior still fail safely without notification delivery.
- Owner approval, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunking, registry validation, and audit evidence remain in place.

Completed chunk:

- Goal 10.1 - Define auth registered-user recipient contract by tenant/app/purpose/channel.

Next unfinished step:

- Goal 10.2 - Define leads recipient contract by tenant/app/purpose/channel.


## 2026-06-13 - Goal 10.2 Leads Recipient Contract Hardening

Current focus: Goal 10 - Cross-Service Recipient And Consent Contract Hardening, chunk 10.2.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Leads remains the source of truth for lead identity, contact data, preferred channels, fallback channels, lifecycle state, qualification fields, consent, unsubscribe state, and lead-to-user conversion references.
- Marketing reads leads-owned recipient and consent data by tenant/app/purpose/channel, stores execution evidence only, and still delegates outbound delivery only to notifications-microservice.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/leads-recipient-consent-contract.md` defining the leads recipient endpoint semantics for tenantId, appId, brandId, purpose, channel, limits, response fields, channel consent semantics, conversion boundary, pagination, safe failure behavior, and ownership boundaries.
- Updated `docs/agents/contracts/preferences-consent-contract.md` and `docs/agents/contracts/integration-api-matrix.md` to reference the leads-specific recipient/consent contract.
- Updated leads recipient source requests to always include campaign scope and delivery decision fields: tenantId, appId, brandId, purpose, channel, optional fallbackChannels, and optional registry scope filters, while preserving segment rule filters.
- Extended recipient response extraction to accept a source-owned `leads` array in addition to existing item/result shapes.
- Extended the configured leads source test to assert scoped leads query parameters and channel-specific consent denial behavior.
- Marked Goal 10.2 complete in `docs/orchestrator/GOALS.md`; Goal 10 remains open.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 30 tests, 30 passing.

Intent Compliance Report:

- Marketing did not take ownership of lead contact, identity, preference, lifecycle, qualification, consent, unsubscribe, or conversion truth.
- Marketing did not implement direct email, Telegram, WhatsApp, or provider delivery.
- Source-owned leads channel consent denial is enforced before notification delegation.
- Leads source outages and invalid source behavior still fail safely without notification delivery.
- Lead conversion references remain source-owned and were not stored as Marketing master records.
- Owner approval, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunking, registry validation, and audit evidence remain in place.

Completed chunk:

- Goal 10.2 - Define leads recipient contract by tenant/app/purpose/channel.

Next unfinished step:

- Goal 10.3 - Define lead-to-user conversion and identity-linking behavior.

## 2026-06-13 - Goal 10.3 Lead-To-User Identity Linking

Current focus: Goal 10 - Cross-Service Recipient And Consent Contract Hardening, chunk 10.3.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth remains the source of truth for registered-user identity, contact data, consent, preferences, and unsubscribe state.
- Leads remains the source of truth for lead identity, contact data, consent, preferences, lifecycle state, and conversion references.
- Marketing may use source-owned lead-to-user references only as transient run-level dedupe evidence and must not create or persist merged contacts, golden profiles, CRM identities, or conversion truth.
- Notifications remains the only outbound delivery executor.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/lead-identity-linking-contract.md` defining source-owned lead-to-user conversion/link fields, resolution rules, consent/unsubscribe behavior, audit evidence, failure behavior, and forbidden Marketing ownership expansions.
- Updated `docs/agents/contracts/integration-api-matrix.md`, `docs/agents/contracts/preferences-consent-contract.md`, and `docs/agents/contracts/leads-recipient-consent-contract.md` to reference the identity-linking boundary.
- Added optional recipient identity-link evidence to Marketing contact normalization for auth and leads source responses.
- Updated recipient resolution dedupe so converted leads with source-owned auth identity links collapse into the linked registered user recipient, with the auth recipient winning when both sources return the same identity.
- Added a regression test proving a converted lead is not delivered separately when the linked auth recipient is also selected.
- Marked Goal 10.3 complete in `docs/orchestrator/GOALS.md`; Goal 10 remains open.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 31 tests, 31 passing.

Intent Compliance Report:

- Marketing did not take ownership of auth contact, lead contact, identity, preference, consent, unsubscribe, lifecycle, qualification, CRM, or conversion truth.
- Marketing did not implement direct email, Telegram, WhatsApp, or provider delivery.
- Lead-to-user links are treated as source-owned recipient resolution evidence only.
- Duplicate delivery to a converted lead and its linked registered user is prevented before notification delegation.
- Owner approval, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunking, registry validation, consent enforcement, and audit evidence remain in place.

Completed chunk:

- Goal 10.3 - Define lead-to-user conversion and identity-linking behavior.

Next unfinished step:

- Goal 10.4 - Define unsubscribe write-through or source-owned write contracts.

## 2026-06-13 - Goal 10.4 Source-Owned Unsubscribe Write Contract

Current focus: Goal 10 - Cross-Service Recipient And Consent Contract Hardening, chunk 10.4.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth remains the durable owner of registered-user unsubscribe, consent, and preference writes.
- Leads remains the durable owner of lead unsubscribe, consent, and preference writes.
- Marketing may accept public unsubscribe intake and forward it to the source owner, but must not become the unsubscribe truth store.
- Notifications remains the only outbound delivery executor.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/unsubscribe-source-write-contract.md` defining Marketing intake, auth/leads write-through endpoints, source-owned durable storage, safe pending-source behavior, and forbidden Marketing ownership expansions.
- Updated the integration matrix, preferences/consent contract, auth recipient contract, and leads recipient contract to reference source-owned unsubscribe writes.
- Added `src/preferences.ts` to forward unsubscribe intake to auth or leads when source URLs are configured, with `source_write_pending` evidence when source configuration is missing, unavailable, or rejected.
- Extended `POST /preferences/unsubscribe` validation and response metadata with optional tenant/app/brand scope, request ID, reason, and source write status evidence.
- Added non-secret runtime keys for unsubscribe forwarding paths/timeouts to `.env.example` and Kubernetes ConfigMap wiring.
- Added contract tests for pending-source unsubscribe intake and configured leads write-through forwarding.
- Marked Goal 10.4 complete in `docs/orchestrator/GOALS.md`; Goal 10 remains open.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 32 tests, 32 passing.

Intent Compliance Report:

- Marketing did not take ownership of auth or leads unsubscribe, consent, preference, contact, identity, lifecycle, qualification, CRM, or conversion truth.
- Marketing did not implement direct email, Telegram, WhatsApp, or provider delivery.
- Source write-through is best-effort intake forwarding only; durable unsubscribe state remains in auth/leads and execution still skips only once source-owned unsubscribe state is visible through recipient resolution.
- Source write failures are accepted with pending-source evidence rather than local replacement truth.
- Owner approval, consent enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunking, registry validation, and audit evidence remain in place.

Completed chunk:

- Goal 10.4 - Define unsubscribe write-through or source-owned write contracts.

Next unfinished step:

- Goal 10.5 - Update source clients and tests after provider contracts exist.

## 2026-06-13 - Goal 10.5 Source Client Contract Alignment And Goal 10 Completion

Current focus: Goal 10 - Cross-Service Recipient And Consent Contract Hardening, chunk 10.5.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth remains the source of truth for registered-user identity, contact data, preferences, consent, unsubscribe state, and registered-user recipient contract behavior.
- Leads remains the source of truth for lead identity, contact data, preferences, consent, unsubscribe state, lifecycle state, and lead conversion references.
- Marketing normalizes source-owned evidence for execution decisions only and still delegates outbound delivery only to notifications-microservice.
- No real campaign was executed against real recipients.

Implementation evidence:

- Updated source client default paths to the provider contracts: `/auth/marketing/recipients` and `/leads/marketing/recipients`, while preserving environment override keys.
- Hardened recipient source response parsing so malformed auth/leads recipient responses become source failure evidence and do not result in notification delegation.
- Added nested source-owned unsubscribe enforcement for normalized `consentByPurposeChannel` evidence, including channel-level `{ granted: true, unsubscribed: true }` records.
- Preserved explicit boolean consent handling so `marketingConsents: { marketing: true }` remains consent evidence, not unsubscribe evidence.
- Extended configured auth/leads tests to assert contract endpoint paths, tenant/app/brand/purpose/channel query fields, channel-specific consent denial, nested unsubscribe skips, and malformed auth response failure.
- Revalidated converted lead/auth deduplication and order/catalog recipient filtering against the updated source-client default paths.
- Marked Goal 10.5 and Goal 10 complete in `docs/orchestrator/GOALS.md`.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 33 tests, 33 passing.

Intent Compliance Report:

- Marketing did not take ownership of auth or leads contact, identity, preference, consent, unsubscribe, lifecycle, qualification, CRM, or conversion truth.
- Marketing did not implement direct email, Telegram, WhatsApp, or provider delivery.
- Tenant/app/purpose/channel consent and unsubscribe evidence is read from source-owned recipient contracts and enforced before notification delegation.
- Converted lead identity links remain source-owned and are used only for run-level dedupe evidence.
- Source outages and malformed source responses fail safely without notification delivery.
- Owner approval, consent enforcement, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunking, registry validation, and audit evidence remain in place.

Completed chunk:

- Goal 10.5 - Update source clients and tests after provider contracts exist.

Completed goal:

- Goal 10 - Cross-Service Recipient And Consent Contract Hardening.

Next unfinished step:

- Goal 11.1 - Define common application signal envelope.


## 2026-06-13 - Goal 11.1 Common Application Signal Envelope

Current focus: Goal 11 - Application Signal Segmentation Contracts, chunk 11.1.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, Statics, and future apps remain the source of truth for their raw behavior facts.
- Marketing may use app behavior signals as segmentation inputs only; it must not become an application event store, CRM master database, contact owner, consent owner, or campaign engine inside each app.
- Auth/leads remain the sources of reachable recipient and consent truth, and notifications remains the only outbound delivery executor.
- No real campaign was executed against real recipients.

Implementation evidence:

- Expanded `docs/agents/contracts/application-signal-contract.md` into the common `marketing.application_signal.v1` envelope for application behavior signals.
- Defined required envelope fields for schema version, stable signal ID, source service, canonical app ID, subject reference, event type, source object, and UTC occurrence time.
- Added scope semantics for tenantId, businessId, brandId, and environment while preserving registry ownership of tenant/app/business truth.
- Added subject reference rules for `auth:user:<id>`, `leads:lead:<id>`, future `crm:account:<id>`, tenant lifecycle references, and anonymous pre-consent facts that cannot produce real delivery recipients until source-resolved.
- Defined event/object semantics, occurred/observed timestamps, idempotency and dedupe expectations, segmentation-safe attributes, related refs, quality evidence, and forbidden secret/contact/consent replacement fields.
- Added safe failure and future validation expectations for malformed signals, unresolved subjects, source outages, replayed signals, and secret-bearing metadata.
- Marked Goal 11.1 complete in `docs/orchestrator/GOALS.md` and advanced `STATE.json` to Goal 11.2.

Validation:

- Documentation-only contract change; no runtime code changed for this chunk.
- Remote contract inspection passed by reading `docs/agents/contracts/application-signal-contract.md` after update.
- `npm run build` and `npm test` were not run because this chunk only defines the common signal envelope and does not change application source or tests.

Intent Compliance Report:

- Marketing did not take ownership of raw application behavior truth, contact data, consent/preferences, provider delivery, tenant registry truth, or CRM/account master data.
- Application signals are constrained to segmentation input and cannot bypass approval, consent, unsubscribe, frequency caps, throttling, max-send limits, idempotency, max-30 notification chunking, or notification delegation.
- Applications remain signal providers only and are explicitly not campaign engines.
- The next chunk remains contract-scoped: define the application-specific signal catalog before adding source clients, ingestion, segment rules, or dry-run behavior.

Completed chunk:

- Goal 11.1 - Define common application signal envelope.

Next unfinished step:

- Goal 11.2 - Define signal catalog for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.

## 2026-06-13 - Goal 11.2 Application Signal Catalog

Current focus: Goal 11 - Application Signal Segmentation Contracts, chunk 11.2.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics remain the source of truth for raw behavior facts and source object state.
- Marketing may use cataloged app signals as segmentation inputs only; it must not become an application event store, contact owner, consent owner, CRM/account owner, notification provider, or campaign engine inside each app.
- Auth/leads remain the sources of reachable recipient and consent truth, tenant/app registry remains the source of scope truth, and notifications remains the only outbound delivery executor.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/application-signal-catalog-contract.md` as the Goal 11.2 app-specific signal catalog contract.
- Defined catalog rules requiring the common `marketing.application_signal.v1` envelope, canonical appId, source-owned subject references, source objects, UTC occurrence time, tenant/app scope where applicable, and segmentation-safe attributes.
- Cataloged initial event classes for Flipflop: product view, cart item added, checkout started, purchase completed, category interest, and inactivity.
- Cataloged initial event classes for SpeakASap: learner registration, course interest, lesson completion, stalled progress, trial start, and subscription state changes.
- Cataloged initial event classes for Marathon: event registration intent, event registration, training plan start, training milestone, event attendance, and participant inactivity.
- Cataloged initial event classes for Bazos: listing creation, listing expiry/expiration, saved search, category interest, and buyer response.
- Cataloged initial event classes for Rent-A-Box: reservation creation, move-in scheduled, active storage, upcoming renewal, capacity threshold, and abandoned reservation.
- Cataloged initial event classes for RunLayer: tenant creation, workflow creation, first workflow run completion, workflow run failure, feature adoption, and usage tier threshold.
- Cataloged initial event classes for Shop Assistant: cart creation/abandonment, recommendation click, merchant setup start/completion, and product intent.
- Cataloged initial event classes for Statics: workspace creation, report creation, dashboard view, workspace inactivity, plan usage threshold, and subscription renewal.
- Added cross-app normalization groups and forbidden catalog expansion rules to prevent raw contact, consent, provider credential, CRM, event-store, or campaign-engine ownership drift.
- Linked the catalog from `docs/agents/contracts/application-signal-contract.md` and `docs/agents/contracts/integration-api-matrix.md`.
- Marked Goal 11.2 complete in `docs/orchestrator/GOALS.md` and advanced `STATE.json` to Goal 11.3.

Validation:

- Documentation-only contract change; no runtime code changed for this chunk.
- Remote contract inspection passed by reading `docs/agents/contracts/application-signal-catalog-contract.md` and the updated Goal 11 checklist after update.
- `STATE.json` parsed successfully after update.
- `npm run build` and `npm test` were not run because this chunk only defines the signal catalog and does not change application source or tests.

Intent Compliance Report:

- Marketing did not take ownership of raw app behavior truth, source object state, contact data, consent/preferences, tenant registry truth, CRM/account master data, provider delivery, or notification channel registry state.
- Cataloged signals are constrained to segmentation input and cannot bypass approval, consent, unsubscribe, frequency caps, throttling, max-send limits, idempotency, max-30 notification chunking, registry validation, recipient resolution, or notification delegation.
- Each application can contribute source-owned behavior signals without implementing local campaigns.
- The next chunk remains contract/runtime-boundary scoped: define the signal source client or event ingestion contract before implementing segment rules or dry-run preview behavior.

Completed chunk:

- Goal 11.2 - Define signal catalog for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.

Next unfinished step:

- Goal 11.3 - Add signal source client or event ingestion contract.

## 2026-06-13 - Goal 11.3 Application Signal Source Client Contract

Current focus: Goal 11 - Application Signal Segmentation Contracts, chunk 11.3.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Applications remain the source of truth for raw behavior facts and source object state.
- Marketing reads app signals as segmentation inputs only, extracts source-owned subject references, and still resolves reachable recipients, contact data, consent, and unsubscribe state through auth/leads.
- Notifications remains the only outbound delivery executor; this chunk does not add direct delivery, provider credentials, local campaign engines inside apps, or event-store ownership in Marketing.
- No real campaign was executed against real recipients.

Implementation evidence:

- Added `app_signals` to the Marketing segment source contract and result source vocabulary.
- Added a read-only application signal source client in `src/sources.ts`, enabled by `APPLICATION_SIGNAL_SOURCE_URL` and optional token/path/limit/timeout configuration.
- The client calls the source endpoint with tenant/app/brand scope plus optional eventType, eventGroup, lifecycleStage, sourceService, sourceObject, subject, and occurred-time filters derived from segment rules.
- The client validates `marketing.application_signal.v1` envelope basics before use: schema version, signalId, sourceService, appId match, eventType, UTC occurredAt, subject reference, and sourceObject.
- The client extracts only `auth:user:<id>` and `leads:lead:<id>` subject refs and uses them to filter recipients resolved from auth/leads; anonymous, tenant-only, CRM/account, and unsupported subjects do not create delivery recipients in this chunk.
- Source outages, missing source URL, malformed envelope data, unsupported schema, mismatched appId, missing subject/sourceObject, or invalid occurredAt fail safely as `app_signals_source_unavailable:*` evidence without notification delegation.
- Added application signal source configuration keys to `.env.example`.
- Updated `docs/agents/contracts/application-signal-contract.md` with the source client endpoint, query, response, configuration, subject extraction, and safe failure contract.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` to include `app_signals` as a segment source type with ownership guardrails.
- Added tests for configured application signal filtering and safe missing-source failure.
- Marked Goal 11.3 complete in `docs/orchestrator/GOALS.md` and advanced `STATE.json` to Goal 11.4.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 35 tests, 35 passing.

Intent Compliance Report:

- Marketing did not take ownership of raw app behavior truth, source object state, contact data, consent/preferences, tenant registry truth, CRM/account master data, provider delivery, or notification channel registry state.
- App signals are used only as recipient filters before auth/leads consent and unsubscribe enforcement.
- Anonymous and unsupported signal subjects do not produce real recipients.
- App-signal source failures fail safely and do not call notifications.
- Owner approval, consent, unsubscribe, frequency caps, throttling, max-send limits, idempotency, max-30 notification chunking, registry validation, recipient resolution, and notification delegation remain enforced.

Completed chunk:

- Goal 11.3 - Add signal source client or event ingestion contract.

Next unfinished step:

- Goal 11.4 - Add segment rules for app events and lifecycle states.

## 2026-06-13 - Goal 11.4 Segment Rules For App Events And Lifecycle States

Current focus: Goal 11 - Application Signal Segmentation Contracts.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Application services remain the source of app event and lifecycle truth.
- App events and lifecycle stages are read-only segmentation inputs only; they do not create contacts, consent truth, unsubscribe truth, campaign engines, or notification delivery behavior inside applications.
- Marketing still resolves reachable recipients through auth/leads and still delegates outbound delivery only to notifications-microservice.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added local executable matching for application signal segment rules in `src/sources.ts`.
- Supported app-signal segment predicates now include event type, event group, lifecycle stage, source service, source object type/id, subject ref, and inclusive `occurredAt` windows.
- The source client still sends these rule filters to the configured application signal source, but Marketing also evaluates returned envelopes locally so a broad or partially filtered provider response cannot widen the audience.
- App signal resolution now records `matchedSignalCount` in `recipient_source_resolved` audit evidence.
- Unsupported subjects such as anonymous, tenant-only, CRM/account, or other refs still do not create delivery recipients in this chunk.
- Updated `docs/agents/contracts/application-signal-contract.md` with the executable segment rule contract and guardrails.
- Added a test proving lifecycle/event rules select only the matching app-signal recipient from a broader source response while excluding non-matching event/lifecycle records and out-of-window records.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 36 tests, 36 passing.

Intent Compliance Report:

- Marketing did not take ownership of raw app event stores, app lifecycle truth, contacts, preferences, consent, unsubscribe state, CRM master data, provider credentials, or channel registry behavior.
- Segment definitions remain Marketing-owned, while app signals remain source-owned facts.
- Recipient contact and consent enforcement remains delegated to auth/leads recipient contracts before notification delegation.
- Direct email, Telegram, and WhatsApp sending was not added.
- Owner approval, consent, unsubscribe, frequency caps, throttling, max-send limits, idempotency, max-30 chunking, and notification delegation remain on the existing execution path.

Completed chunk:

- Goal 11.4 - Add segment rules for app events and lifecycle states.

Next unfinished step:

- Goal 11.5 - Add dry-run preview support and failure evidence.

## 2026-06-13 - Goal 11.5 Dry-Run Preview Support And Failure Evidence

Current focus: Goal 11 - Application Signal Segmentation Contracts.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Applications remain the source of app event and lifecycle truth.
- App-signal dry-run evidence is derived from source-owned envelopes and Marketing-owned segment rules; it does not create contact, consent, unsubscribe, CRM, or app event master data in Marketing.
- Marketing still resolves reachable recipients through auth/leads and delegates outbound delivery only to notifications-microservice.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added app-signal preview evidence for reachable-but-empty signal audiences.
- App-signal segments now record skipped source evidence with `recipientRef: app_signals:source` for:
  - `app_signals_no_source_signals`
  - `app_signals_no_matching_signals`
  - `app_signals_no_resolvable_subject_refs`
- Source outages, missing source URL, malformed envelopes, unsupported schema, app mismatch, missing subject/sourceObject, and invalid `occurredAt` remain failed source evidence as `app_signals_source_unavailable:*`.
- App-signal preview evidence returns before broad auth/leads recipient resolution when no signal-backed subject refs can produce recipients.
- Dry-run app-signal failure evidence still completes as `dry_run_completed` and never calls notifications.
- Updated `docs/agents/contracts/application-signal-contract.md` with dry-run preview and failure evidence behavior.
- Added tests for dry-run no-matching-signal preview evidence and dry-run app-signal source failure evidence without notification delivery.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 38 tests, 38 passing.

Intent Compliance Report:

- Marketing did not take ownership of raw app signals, app lifecycle truth, auth/leads contact data, consent, unsubscribe state, CRM/account master data, notification provider execution, provider credentials, or channel registry behavior.
- App-signal preview evidence only explains segmentation outcomes and does not authorize delivery.
- Owner approval, consent, unsubscribe, frequency caps, throttling, max-send limits, idempotency, max-30 notification chunking, registry validation, recipient resolution, and notification delegation remain enforced on the execution path.
- Applications can contribute signals without implementing campaign engines.

Completed chunk:

- Goal 11.5 - Add dry-run preview support and failure evidence.

Completed goal:

- Goal 11 - Application Signal Segmentation Contracts.

Next unfinished step:

- Goal 12.1 - Add campaign catalog metadata model.

## 2026-06-13 - Goal 12.1 Campaign Catalog Metadata Model

Current focus: Goal 12 - Multi-Application Campaign Catalog.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Campaign catalog metadata is Marketing-owned discovery metadata for organizing campaigns across tenant, app, product line, lifecycle, audience, family, category, tags, and future blueprint references.
- Catalog metadata is non-executable and does not approve, schedule, dry-run, execute, send, or bypass any delivery guardrails.
- Template references remain references; Marketing does not own notification provider templates or outbound provider execution.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added `CampaignCatalogMetadata` to `src/types.ts` and optional `catalogMetadata` on `Campaign`.
- Added campaign API validation for `catalogMetadata` fields:
  - `campaignFamily`
  - `lifecycleStage`
  - `audienceKey`
  - `audienceLabel`
  - `catalogCategory`
  - `catalogTags`
  - `sourceBlueprintId`
- Validation rejects execution/control fields inside catalog metadata, including approval, status, schedule, execute, and dry-run fields.
- Campaign create/update now carries catalog metadata through the API model and audit logs.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` with the campaign catalog metadata contract and non-executable guardrails.
- Added API contract coverage proving catalog metadata is accepted as discovery metadata and cannot smuggle execution/approval controls.
- PostgreSQL persistence/migration remains intentionally deferred to Goal 12.5, which is the migration and tests chunk.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 39 tests, 39 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Catalog metadata does not authorize real delivery; campaigns still require explicit owner approval and all existing consent, unsubscribe, frequency-cap, throttling, max-send, idempotency, max-30 chunking, registry validation, and notification delegation gates.
- Future blueprint references are stored as references only and do not execute.

Completed chunk:

- Goal 12.1 - Add campaign catalog metadata model.

Next unfinished step:

- Goal 12.2 - Add lifecycle stage and campaign family enums/contracts.

## 2026-06-13 - Goal 12.2 Lifecycle Stage And Campaign Family Enums

Current focus: Goal 12 - Multi-Application Campaign Catalog.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Campaign family and lifecycle stage are Marketing-owned catalog taxonomy values for discovery and organization only.
- The enum contract does not approve, schedule, execute, dry-run, send, or bypass any delivery guardrail.
- Template references remain references; Marketing does not own notification provider templates or outbound provider execution.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added shared `CampaignLifecycleStage` and `CampaignFamily` union types in `src/types.ts`.
- Added API validation arrays for the shared lifecycle stage and campaign family vocabularies in `src/api-contracts.ts`.
- `catalogMetadata.lifecycleStage` now accepts only the shared lifecycle values from `docs/agents/contracts/application-portfolio-taxonomy.md`.
- `catalogMetadata.campaignFamily` now accepts only the shared campaign family values documented in the campaign contract and portfolio taxonomy.
- Unsupported family/stage values fail with stable `invalid_campaign_request` field errors instead of becoming ad hoc taxonomy.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` with the Goal 12.2 enum contract and guardrails.
- Updated `docs/agents/contracts/application-portfolio-taxonomy.md` with the shared campaign family vocabulary.
- Extended API contract tests to cover accepted enum values and rejected custom family/stage values.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 39 tests, 39 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Campaign family and lifecycle stage metadata do not authorize real delivery; campaigns still require explicit owner approval and all existing consent, unsubscribe, frequency-cap, throttling, max-send, idempotency, max-30 chunking, registry validation, and notification delegation gates.
- Future blueprint work remains separate and cannot execute without normal campaign creation and approval gates.

Completed chunk:

- Goal 12.2 - Add lifecycle stage and campaign family enums/contracts.

Next unfinished step:

- Goal 12.3 - Add application-specific default campaign blueprints.

## 2026-06-13 - Goal 12.3 Application-Specific Default Campaign Blueprints

Current focus: Goal 12 - Multi-Application Campaign Catalog.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Default campaign blueprints are Marketing-owned catalog suggestions for business users and future catalog APIs.
- Blueprints are non-executable: they do not approve, schedule, execute, dry-run, send, or bypass delivery guardrails.
- Template references remain references; Marketing does not own notification provider templates or outbound provider execution.
- Applications contribute signal semantics only and do not become campaign engines.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added `CampaignBlueprint` to `src/types.ts` with app, family, lifecycle, audience, category, tags, suggested channels, `templateRef`, and segment-rule suggestion fields.
- Added `src/campaign-blueprints.ts` with one default blueprint each for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.
- Added deterministic blueprint lookup and filter helpers for future Goal 12.4 catalog API work.
- Blueprints carry `catalogMetadata.sourceBlueprintId` back to their `blueprintId` and align family/lifecycle/audience metadata with the blueprint root fields.
- Blueprint objects intentionally omit approval state, campaign status, schedule fields, execution commands, dry-run flags, message bodies, contact data, consent truth, unsubscribe truth, provider credentials, and provider-template content.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` with the default blueprint contract and initial blueprint table.
- Updated `docs/agents/contracts/application-portfolio-taxonomy.md` with the default application blueprint table and blueprint guardrails.
- Added `test/campaign-blueprints.test.ts` covering application coverage, uniqueness, metadata alignment, deterministic filters/lookups, and non-executable field exclusions.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 42 tests, 42 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Blueprints do not authorize real delivery; campaigns created from a future blueprint flow must still start as draft/pending approval and pass all existing consent, unsubscribe, frequency-cap, throttling, max-send, idempotency, max-30 chunking, registry validation, and notification delegation gates.
- Application-specific blueprint defaults organize campaign discovery without moving campaign ownership into applications.

Completed chunk:

- Goal 12.3 - Add application-specific default campaign blueprints.

Next unfinished step:

- Goal 12.4 - Add catalog APIs and filters.

## 2026-06-13 - Goal 12.4 Catalog APIs And Filters

Current focus: Goal 12 - Multi-Application Campaign Catalog.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Catalog APIs are read-only discovery surfaces for campaign definitions and default blueprints.
- Catalog APIs do not approve, schedule, execute, dry-run, resolve recipients, send, or bypass delivery guardrails.
- Template references remain references; Marketing does not own notification provider templates or outbound provider execution.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added read-only `GET /campaign-catalog/blueprints` with filters for app, product line, purpose, campaign family, lifecycle stage, audience key, catalog category, and catalog tag.
- Added read-only `GET /campaign-catalog/blueprints/:blueprintId` detail lookup with `blueprint_not_found` for missing blueprints.
- Added read-only `GET /campaign-catalog/campaigns` for campaign discovery with scope filters plus purpose, campaign family, lifecycle stage, audience key, catalog category, catalog tag, and source blueprint filters.
- Campaign discovery passes only tenant/app/brand/business/product-line/lifecycle-scope/environment fields into the store and applies catalog metadata filters in the API layer.
- Blueprint filter helpers now support audience, category, and tag filtering for the upcoming persisted catalog work.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` and `docs/agents/contracts/integration-api-matrix.md` with the catalog API contract.
- Extended API tests to cover blueprint list/detail/tag filters, not-found behavior, and campaign catalog filtering by tenant/app/product line/lifecycle/purpose/tag.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 43 tests, 43 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Catalog APIs are read-only and do not authorize real delivery; campaigns still require explicit owner approval and all existing consent, unsubscribe, frequency-cap, throttling, max-send, idempotency, max-30 chunking, registry validation, and notification delegation gates.
- Blueprint APIs expose suggestions only and do not move campaign ownership into applications.

Completed chunk:

- Goal 12.4 - Add catalog APIs and filters.

Next unfinished step:

- Goal 12.5 - Add migration and tests.


## 2026-06-13 - Goal 12.5 Migration And Tests

Current focus: Goal 12 - Multi-Application Campaign Catalog.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Campaign catalog metadata is Marketing-owned discovery metadata persisted with campaign definitions.
- The migration does not add delivery behavior, approval bypasses, recipient/contact ownership, consent truth, unsubscribe truth, provider template ownership, or notification provider execution.
- Template references remain references; Marketing does not own provider template delivery.
- This session did not execute any real campaign against real recipients.

Implementation evidence:

- Added `migrations/0006_campaign_catalog_metadata.sql` with `marketing_campaigns.catalog_metadata jsonb` plus indexes for campaign family, lifecycle stage, audience key, catalog category, source blueprint, and catalog tags.
- Updated `PostgresMarketingStore.saveCampaign` to persist `catalogMetadata` as JSONB and preserve it during campaign updates.
- Updated PostgreSQL campaign row mapping to return `catalogMetadata` on `getCampaign`, `listCampaigns`, scheduler claims, and other persisted campaign reads.
- Added `test/store.test.ts` covering PostgreSQL campaign persistence SQL/value mapping and catalog metadata round-trip behavior.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 44 tests, 44 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Catalog metadata remains non-executable discovery metadata; it does not approve, schedule, execute, dry-run, resolve recipients, send, or bypass existing consent, unsubscribe, frequency-cap, throttling, max-send, idempotency, max-30 chunking, registry validation, and notification delegation gates.
- Goal 12 acceptance criteria remain satisfied: campaigns can be discovered by scope and catalog metadata, blueprints remain non-executable, and template refs remain references.

Completed chunk:

- Goal 12.5 - Add migration and tests.

Completed goal:

- Goal 12 - Multi-Application Campaign Catalog.

Next unfinished step:

- Goal 13 - Lifecycle Journey Engine.


## 2026-06-13 - Goal 13.1 Journey Definitions

Current focus: Goal 13 - Lifecycle Journey Engine.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Journey definitions are Marketing-owned orchestration metadata for future approved multi-step journeys.
- Journey steps reference existing campaign definitions; they do not duplicate message bodies, templates, provider settings, contact data, consent truth, unsubscribe truth, or notification delivery behavior.
- Goal 13.1 is definition-only: it does not activate journeys, enroll recipients, execute steps, dry-run journeys, call notifications, or bypass campaign approval and recipient safety gates.
- This session did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Added Journey model types for triggers, ordered campaign steps, exit rules, suppression rules, and draft status in `src/types.ts`.
- Added journey request validation in `src/api-contracts.ts`, including read-only execution/approval fields, trigger type checks, non-empty step validation, duplicate step ID checks, flat condition/rule object validation, and allowed exit/suppression rule types.
- Added protected journey definition CRUD endpoints and read endpoints in `src/main.ts`:
  - `POST /journeys`
  - `GET /journeys`
  - `GET /journeys/:id`
  - `PUT /journeys/:id`
  - `DELETE /journeys/:id`
- Journey creation/update validates tenant/app/brand registry scope and verifies referenced campaign and segment IDs before saving.
- Added in-memory and PostgreSQL store support for journey definitions in `src/store.ts`.
- Added `migrations/0007_journey_definitions.sql` for durable journey definition storage and scope/status/trigger indexes.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` and `docs/agents/contracts/integration-api-matrix.md` with the journey definition contract and API surface.
- Added API tests for draft non-executable journey creation/list/detail behavior, executable metadata rejection, and missing reference rejection.
- Added store tests for PostgreSQL journey trigger/steps/suppression persistence mapping.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 47 tests, 47 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Journey definitions do not authorize real delivery; future step execution must reuse existing campaign execution and keep explicit owner approval, consent, unsubscribe, frequency-cap, throttling, max-send, idempotency, max-30 chunking, registry validation, notification delegation, and audit gates intact.
- Exit and suppression rules are stored as future decision metadata only in this chunk; they do not create source-owned facts or directly suppress outside journey execution logic.

Completed chunk:

- Goal 13.1 - Add journey definitions, steps, triggers, exit rules, and suppression rules.

Next unfinished step:

- Goal 13.2 - Add approval gate for journey activation.


## 2026-06-13 - Goal 13.2 Journey Activation Approval Gate

Current focus: Goal 13 - Lifecycle Journey Engine.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Journey approval evidence is Marketing-owned activation governance for journey definitions.
- Journey activation is status-only in this chunk: it does not enroll recipients, schedule steps, execute campaigns, dry-run journeys, resolve contacts, call notifications, or modify source-owned preferences.
- Future journey step execution must still reuse campaign execution so explicit campaign approval, recipient consent, unsubscribe checks, frequency caps, throttling, max-send, idempotency, max-30 chunking, registry validation, notification delegation, and audit gates remain enforced.
- This session did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Added journey approval metadata to `Journey`: `approvalStatus`, `approvedBy`, `approvedAt`, `approvalNote`, and `activatedAt`.
- New journeys now start as `status: draft` with `approvalStatus: pending`.
- Added protected `POST /journeys/:id/approve` to require explicit owner actor evidence and record approval metadata.
- Added protected `POST /journeys/:id/activate` to require approved journey evidence before marking a journey `active` and recording `activatedAt`.
- Activation does not create execution runs, enqueue work, call notifications, or execute referenced campaign steps.
- Updated `PostgresMarketingStore` and `rowToJourney` to persist and return journey approval/activation metadata.
- Added `migrations/0008_journey_activation_approval.sql` for journey approval columns and indexes.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` and `docs/agents/contracts/integration-api-matrix.md` with the approval/activation endpoints and guardrails.
- Added API tests covering pending draft journeys, unapproved activation rejection, missing approval actor rejection, approval evidence recording, status-only activation, and no execution runs created by activation.
- Updated store tests to cover journey approval metadata persistence defaults.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 48 tests, 48 passing.

Intent Compliance Report:

- Marketing did not take ownership of provider templates, notification provider execution, channel registry behavior, auth/leads contacts, consent, unsubscribe truth, raw app events, order truth, catalog product truth, tenant registry truth, CRM/account master data, or analytics truth.
- Active journey status does not authorize real delivery in this chunk; future step execution remains blocked until Goal 13 scheduler/idempotency logic explicitly reuses existing approved campaign execution and safety gates.
- Approval metadata is governance evidence only and does not duplicate campaign approval, contact ownership, or source-owned consent/preference state.

Completed chunk:

- Goal 13.2 - Add approval gate for journey activation.

Next unfinished step:

- Goal 13.3 - Add scheduler/idempotency integration for journey steps.

## 2026-06-13 - Parallel Planning Refactor

Current focus: orchestrator planning refactor for parallel agent execution.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Notifications remains the owner of outbound provider execution and channel registry behavior.
- Auth and leads remain the owners of identity, contact data, preferences, and consent.
- Domain/app/CRM/analytics services remain source-signal or read-model owners and do not become campaign engines.
- This session changed planning and orchestration documents only; it did not execute campaigns, deploy, or alter runtime delivery behavior.

Implementation evidence:

- Updated `docs/orchestrator/PLAN.md` to make maximum safe parallelism the default planning rule.
- Reconciled the current next focus to Goal 13.3 based on `STATE.json` and completed evidence, replacing the stale Goal 11 pointer.
- Added a current parallel execution assessment with blockers, allowed/forbidden files, expected outputs, validation, and integration order for Goal 13.3, Goal 14, Goal 15, Goal 19, and Goal 20.
- Updated `AGENTS.md` so Codex planning for this repository must identify independently startable workstreams, blockers, file ownership, validation, and merge order.
- Updated `docs/orchestrator/MASTER_PROMPT.md` and `docs/orchestrator/PROMPTS.md` so future sessions and handoffs include parallel execution assessment before assigning agents.
- Reconciled stale coordinator task state by removing completed Goal 10 and Goal 12 backlog/open-task references from `TASKS.md` and `STATE.json`.

Parallel tasks currently startable:

- Track A: Goal 13.3 journey scheduler/idempotency integration can start now as the backend runtime priority.
- Track B: Goal 14.1/14.2 public landing/static pipeline can start now if it avoids admin API/RBAC and journey runtime files.
- Track C: Goal 15 auth/RBAC shell can start after auth session verification contract discovery; isolated backend discovery can run in parallel.
- Track D: Goal 19 CRM/account contract draft can start now as documentation/contract work only; runtime client work is blocked by missing CRM/account service contract.
- Track E: Goal 20 governance/readiness draft can start now as documentation/policy work only; enforcement code is blocked by policy decisions and runtime/admin foundations.

Validation:

- Documentation/state validation only: `STATE.json` was parsed and rewritten as valid JSON.
- Runtime `npm run build` and `npm test` were not run because no application source code changed.

Intent Compliance Report:

- The refactor increases orchestration clarity without expanding Marketing ownership.
- Planning now names blockers instead of allowing agents to invent contracts or duplicate ownership.
- Parallel execution is limited to disjoint files/workstreams with a final integration/validation owner.
- Real campaign execution remains prohibited without explicit owner approval.

Next unfinished step:

- Goal 13.3 - Add scheduler/idempotency integration for journey steps.


## 2026-06-13 - Goal 13.3 Journey Step Scheduler And Idempotency

Current focus: Goal 13 - Lifecycle Journey Engine.

Preserved intent and ownership boundary:

- Marketing owns journey definition state, journey step scheduler claims, campaign execution orchestration, idempotency evidence, and audit state.
- Notifications remains the only outbound provider executor; journey steps do not send directly and still delegate through the existing campaign executor.
- Auth and leads remain the owners of identity, contact data, preferences, consent, and unsubscribe truth.
- Journey step execution remains behind explicit journey approval/activation and explicit campaign approval; this session did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Added `JourneyStepClaim` state for due journey step claims, scheduler owner/lock expiry, run reference, completion status, and errors.
- Added in-memory and PostgreSQL store support for claiming due active approved journey steps and completing step claims.
- Added `migrations/0009_journey_step_scheduler_idempotency.sql` with `marketing_journey_step_claims`, uniqueness on `journey_id + step_id + due_at`, due/claim indexes, and run references.
- Extended `runDueScheduledCampaigns` so `POST /scheduler/run-due` also claims due journey steps from active approved journeys after step delay from `activatedAt`.
- Journey step execution uses deterministic idempotency keys in the form `journey:<journeyId>:<stepId>:<dueAt>` and calls `executeCampaign` for the referenced campaign.
- Duplicate scheduler calls cannot execute the same due journey step twice once the step claim is completed.
- Updated scheduler API output and audit events with journey step claimed/executed/failed counts.
- Updated contracts with the Goal 13.3 scheduler/idempotency behavior and guardrails.
- Added API coverage for active approved journey step claiming, deterministic journey idempotency keys, and duplicate scheduler no-op behavior.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 49 tests, 49 passing.

Intent Compliance Report:

- Journey steps reuse the existing campaign executor, preserving campaign approval, consent enforcement, unsubscribe checks, frequency caps, throttling, max-send limits, max-30 notification chunking, registry validation, notification delegation, and execution audit evidence.
- Marketing did not add direct provider calls, provider credentials, contact storage, consent truth, unsubscribe truth, or a separate recipient engine.
- Step claim idempotency is Marketing-owned scheduler state and does not change source-owned identity/preference boundaries.
- Real delivery remains possible only through explicitly invoked scheduler execution of approved active journeys and approved executable campaigns; no automatic daemon or real recipient execution was run in this session.

Completed chunk:

- Goal 13.3 - Add scheduler/idempotency integration for journey steps.

Next unfinished step:

- Goal 13.4 - Add dry-run preview for journey enrollment and next actions.


## 2026-06-13 - Goal 13.4 Journey Dry-Run Preview

Current focus: Goal 13 - Lifecycle Journey Engine.

Preserved intent and ownership boundary:

- Marketing owns journey preview orchestration, journey definitions, campaign dry-run summaries, and audit state.
- Notifications remains the only outbound provider executor; journey dry-run preview does not call notifications or send messages.
- Auth and leads remain the owners of identity, contact data, preferences, consent, and unsubscribe truth; preview reads recipient decisions through the existing campaign dry-run path only.
- This session did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Added protected `POST /journeys/:id/dry-run`.
- Journey dry-run preview returns trigger/enrollment context, calculated step due times from `previewStartAt` or activation time, and per-step next-action summaries.
- Per-step summaries reuse `executeCampaign(..., { dryRun: true })` and return counts/status/reason summaries instead of message bodies or notification provider data.
- Preview supports draft, approved, or active journeys for planning, but does not activate journeys, create scheduler claims, complete step claims, call notifications, or record sent history.
- Added API coverage proving preview leaves the journey in draft state, creates only campaign dry-run runs, and leaves scheduler journey-step claims at zero.
- Updated the journey contract and integration API matrix with the dry-run preview endpoint and delivery-free constraints.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 50 tests, 50 passing.

Intent Compliance Report:

- Journey preview remains planning-only and does not authorize or perform real delivery.
- Existing campaign dry-run continues to enforce recipient consent/unsubscribe/frequency decision logic without notification delegation or send-history writes.
- Marketing did not take ownership of provider execution, provider credentials, auth/leads contacts, source-owned consent, source-owned unsubscribe truth, application event truth, order truth, or catalog truth.
- Preview output summarizes decision evidence without embedding message bodies, provider credentials, authorization tokens, or notification-provider data.

Completed chunk:

- Goal 13.4 - Add dry-run preview for journey enrollment and next actions.

Next unfinished step:

- Goal 13.5 - Add audit evidence for step decisions.


## 2026-06-13 - Goal 13.3 Delegated Track A Verification

Current focus: Goal 13 - Lifecycle Journey Engine.

Delegation: Track A / Goal 13.3 scheduler/idempotency integration for journey steps.

Preserved intent and boundaries:
- Marketing remains the campaign and segmentation control plane for journey definitions, scheduler claims, campaign execution orchestration, idempotency evidence, and audit state.
- Journey steps do not send directly and do not own provider behavior; execution delegates to the existing campaign executor and notifications-microservice remains the outbound provider executor.
- Auth and leads remain source owners for contact data, preferences, and consent; this verification did not change source-of-truth models.
- This session did not execute a real campaign or journey against real recipients.

Verification evidence:
- Confirmed current implementation includes persisted `JourneyStepClaim` state, deterministic journey step idempotency keys, scheduler output for journey step claims/executions/failures, and `marketing_journey_step_claims` uniqueness on `journey_id + step_id + due_at`.
- Confirmed `runDueScheduledCampaigns` claims due active approved journey steps and calls `executeCampaign` with `journey:<journeyId>:<stepId>:<dueAt>` keys, keeping campaign approval, recipient consent, unsubscribe, frequency cap, throttling, max-send, max-30 chunking, registry validation, notification delegation, and audit behavior on the existing campaign path.
- `npm run build` passed on remote repository.
- `npm test` passed on remote repository: 49 tests, 49 passing.
- Targeted coverage observed: `journey scheduler claims due active steps idempotently`, `scheduler claim prevents duplicate due scheduled execution`, and existing executor safety tests for approval, consent, unsubscribe, frequency cap, idempotency, max-send guardrails, notification chunk size, and `<=30` notification chunking.

Intent Compliance Report:
- Delivery delegation preserved: yes, journey steps use `executeCampaign`; no direct email, Telegram, WhatsApp, or provider calls were added.
- Approval gates preserved: yes, due journey steps require active approved journey evidence and execute only through approved campaign execution.
- Consent and unsubscribe enforcement preserved: yes, recipient decisions remain in the campaign executor path.
- Frequency caps, throttling, max-send, max-30 chunking, and idempotency preserved: yes, journey scheduler integration reuses existing campaign executor controls and deterministic step idempotency keys.
- Contact/source ownership preserved: yes, no auth/leads ownership model or preference truth was changed.
- Validation complete: yes, remote `npm run build` and `npm test` passed.

Next handoff:
- Goal 13.3 is verified complete in the current remote worktree.
- Goal 13.4 dry-run preview for journey enrollment and next actions may start after integration ownership accepts the current Goal 13.3 worktree state.

## 2026-06-13 - Goal 19.1-19.2 CRM Account Read-Only Signal Contract Draft

Current focus: Goal 19 - CRM/Account Service Integration, chunks 19.1 and 19.2.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- CRM/account master data remains owned by a future CRM/account service, not Marketing.
- Account, company, opportunity, owner, lifecycle, health, onboarding, renewal, upsell, and winback fields are read-only segmentation signals only.
- Marketing may store source references, decision snapshots, dry-run evidence, run outcomes, suppression/frequency-cap evidence, and audit metadata; it must not store or edit CRM master records.
- CRM account lifecycle or opportunity state must never imply recipient marketing consent.
- Real delivery still requires explicit campaign approval, source-owned recipient consent, unsubscribe checks, frequency caps, throttling, idempotency, max-send limits, max-30 chunking, registry validation, and notification delegation through notifications-microservice.
- This session did not implement a runtime CRM client, database ownership migration, journey runtime behavior, admin UI, deployment, or real campaign execution.

Implementation evidence:

- Added `docs/agents/contracts/crm-account-signal-contract.md` as the Goal 19.1-19.2 read-only signal draft.
- Defined the future preferred read endpoint draft: `GET {CRM_ACCOUNT_SERVICE_URL}{CRM_ACCOUNT_SIGNAL_PATH:-/marketing/account-signals}`.
- Defined account signal fields for account/company IDs, tenant/app/brand scope, owner references, lifecycle stage, health status/score, onboarding status, plan tier, risk level, renewal date, customer-success touch timestamp, source update timestamp, related opportunities, and relationship-only `contactRefs`.
- Defined opportunity signal fields for opportunity/account/company IDs, tenant/app/brand scope, opportunity stage/status/type, owner reference, amount/currency/probability, expected close date, source update timestamp, and relationship-only `contactRefs`.
- Added initial enum drafts for lifecycle stage, opportunity stage/status/type, health status, and onboarding status.
- Documented contact and consent boundaries: CRM `contactRefs` must not include raw addresses, channel handles, consent truth, unsubscribe truth, or preferred-channel truth; reachable recipients must still resolve through auth/leads.
- Documented future CRM/account segment predicate placeholders and safe failure/audit reasons.
- Updated `docs/agents/contracts/crm-account-boundary-contract.md` to point to the new signal contract.
- Updated `docs/agents/contracts/integration-api-matrix.md` to reference the CRM account signal contract and runtime blocker.
- Marked Goal 19 chunks 19.1 and 19.2 complete in `docs/orchestrator/GOALS.md`; chunks 19.3-19.5 remain open.

Blockers recorded:

- `[MISSING: CRM/account service base URL]`
- `[MISSING: CRM/account service auth method]`
- `[MISSING: CRM/account read endpoint path]`
- `[MISSING: CRM/account sample account signal response]`
- `[MISSING: CRM/account sample opportunity signal response]`
- `[MISSING: CRM/account pagination and rate-limit contract]`
- `[MISSING: CRM/account error response contract]`

Validation:

- Documentation review completed against `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/agents/contracts/crm-account-boundary-contract.md`, and `docs/agents/contracts/integration-api-matrix.md`.
- `npm run build` was not run because this session changed only Markdown contract/status documentation and added no generated docs, imports, runtime code, or tests.

Intent Compliance Report:

- Marketing did not take ownership of CRM/account master data, company records, opportunities, lifecycle state, account owner assignments, health state, onboarding state, customer-success notes, contact data, consent, unsubscribe state, provider credentials, or direct delivery.
- CRM/account signals are documented as read-only segmentation inputs and future dry-run/audit evidence only.
- Runtime CRM chunks 19.3-19.5 remain blocked until the missing service contract facts are approved.
- Notification delegation, explicit owner approval, source-owned consent, unsubscribe enforcement, frequency caps, throttling, max-send limits, idempotency, max-30 chunks, and registry validation remain preserved.

Completed chunks:

- Goal 19.1 - Define CRM/account read-only signal contract.
- Goal 19.2 - Define account, opportunity, lifecycle stage, owner, health, and onboarding status fields.

Next unfinished step:

- Goal 19.3 - Add CRM signal source client once service exists; blocked by missing CRM/account service contract, base URL, auth method, endpoint path, and sample responses.

## 2026-06-13 - Goal 20.1-20.5 Governance And Readiness Draft

Current focus: Goal 20 - Production Governance And Readiness, documentation/policy draft only.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign risk, approval evidence, execution readiness, policy references, and operational audit state.
- Notifications remains the only outbound provider executor; this session did not add provider calls, provider credentials, or notification sending behavior.
- Auth and leads remain the owners of identity, contact data, consent, preferences, and unsubscribe truth.
- Tenant/app/business registry remains the owner of tenant/app timezone, policy reference, and canonical scope truth.
- This session did not deploy and did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Added `docs/agents/contracts/production-governance-readiness-contract.md` defining production risk classes (`low`, `standard`, `high`, `restricted`), stronger high-risk approval design, quiet-hour and tenant/app policy guardrail proposal, readiness checklist, and future enforcement boundaries.
- Added `docs/operations/production-readiness-playbook.md` with pre-execution, deployment, rollback, incident review, and unsubscribe escalation checklists.
- Marked unresolved production decisions as `[MISSING: ...]`: recipient-count thresholds, high-risk approver identity sources, governance/operations approver identity source, restricted exception owner, quiet-hour defaults by weekend/channel/emergency override, and confirmed rollback command/version policy.
- Kept enforcement code explicitly blocked until owner confirms thresholds, approvers, quiet-hour defaults, rollback procedure, and until journey runtime plus admin auth foundations are stable.

Validation:

- Documentation review against `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/agents/contracts/marketing-campaign-contract.md`, `docs/agents/contracts/preferences-consent-contract.md`, `docs/agents/contracts/channel-registry-contract.md`, and `docs/agents/contracts/integration-api-matrix.md`.
- Runtime `npm run build` and `npm test` were not run because only new governance/playbook documentation changed.
- No deployment was run; deployment remains blocked without explicit owner approval.

Intent Compliance Report:

- The governance draft strengthens owner approval, auditability, production readiness, unsubscribe escalation, and policy review without weakening existing campaign approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, or notification delegation gates.
- The draft does not move provider execution into Marketing, does not duplicate auth/leads contact or consent ownership, and does not create tenant/app policy truth inside Marketing.
- High-risk and restricted campaign controls are documented as additional gates, not replacements for existing execution safety controls.

Completed draft chunks:

- Goal 20.1 - Campaign risk classification draft.
- Goal 20.2 - High-risk approval workflow draft.
- Goal 20.3 - Quiet-hour and tenant/app policy guardrail proposal.
- Goal 20.4 - Real-execution confirmation and rollback/incident/unsubscribe playbook draft.
- Goal 20.5 - Production readiness validation and deployment checklist draft.

Next unfinished step:

- Owner confirmation required for missing production policy decisions before enforcement code or production deployment.


## 2026-06-13 - Goal 14.1-14.2 Public Landing And Static Pipeline

Current focus: Goal 14 - Landing Page And Auth Entry Points, Track B partial implementation.

Preserved intent and ownership boundary:

- Marketing may present a public entry point for business users, but it remains the campaign and segmentation control plane.
- Auth remains the owner of registration, login, user identity, session verification, contact data, and registered-user consent/preferences.
- Notifications remains the owner of outbound provider execution and channel registry behavior.
- The public landing page does not expose service tokens, admin data, recipient/contact data, campaign execution controls, journey runtime controls, provider credentials, or protected admin APIs.
- This session did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Added a minimal frontend/static build pipeline: npm run build now runs TypeScript compilation and copies public assets into dist/public through scripts/copy-public.mjs.
- Updated Dockerfile builder stage to include scripts and public assets before the build, so the runtime image receives dist/public through the existing dist copy.
- Added public/index.html and public/assets/landing.css for the anonymous Marketing landing page.
- Added public/assets/marketing-dashboard-bg.png as a generated bitmap dashboard backdrop for the landing page.
- Added Express static serving for /assets plus anonymous GET / and GET /landing routes in src/main.ts.
- Register and Log in are intentionally disabled placeholder buttons because final auth login/register URLs and return URL format remain blocked pending auth-microservice contract confirmation.
- Admin navigation is intentionally not linked because the Goal 15 protected admin shell route is not defined yet.
- Added API smoke coverage proving the public landing and CSS are anonymous static content and do not expose MARKETING_API_TOKEN, SERVICE_API_TOKEN, x-service-token, campaign execution paths, or scheduler execution paths.

Validation:

- Remote npm run build passed on 2026-06-13.
- Remote npm test passed on 2026-06-13: 51 tests, 51 passing.
- Rendered validation used ssh port forwarding to http://127.0.0.1:4614 with MARKETING_STORE=memory.
- In-app Browser validation was attempted first but failed because the browser webview did not attach.
- Unsandboxed Playwright fallback captured desktop 1440x960 and mobile 390x844 screenshots at /private/tmp/marketing-landing-desktop.png and /private/tmp/marketing-landing-mobile.png.
- Playwright validation passed: HTTP 200, title Statex Marketing, expected landing content present, no console errors or warnings, no horizontal overflow, and the public Status link navigated to /health with status ok.

Intent Compliance Report:

- Marketing did not implement auth-owned registration, login, session verification, or RBAC.
- Marketing did not expose service tokens, Authorization headers, source-owner tokens, protected admin data, campaign execution controls, journey scheduler controls, recipient/contact data, provider credentials, message bodies, or notification provider controls on the public page.
- Public landing content describes Marketing-owned orchestration capability without taking ownership of auth, leads, notifications, registry, app signal, order, catalog, CRM, or analytics truth.
- Real campaign and journey execution remain protected by existing service-token and approval gates and were not triggered.

Completed chunks:

- Goal 14.1 - Add frontend build pipeline and static serving.
- Goal 14.2 - Build landing page for Marketing platform capabilities.

Blocked next chunks:

- Goal 14.3 - Add register, login, and admin buttons remains partially blocked for final destinations. Register and login require confirmed auth-microservice URLs and return URL format. Admin requires the Goal 15 shell route.
- Goal 14.4 - Route login/register through auth-microservice with return URLs is blocked by missing confirmed auth URL and return URL contract.
- Goal 14.5 - Deployment/static asset validation waits for final auth/admin navigation and owner-approved deployment.

## 2026-06-13 - Goal 15 Track C Admin Auth And RBAC Shell Discovery

Current focus: Goal 15 - Admin Auth And RBAC Shell, isolated Track C discovery plus backend shell.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Auth remains the source of truth for user identity, JWT/session validation, and RBAC role claims.
- Browser admin requests use Auth-issued user tokens only; the browser is not given `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`.
- Existing service-token API consumers remain compatible and continue using the existing protected API contract.
- This session did not change journey scheduler/runtime files, campaign/segment management UI, runs/audit/analytics views, notification delivery, source-owned contact data, consent truth, or real campaign execution behavior.

Discovery report:

- Marketing docs require Goal 15 to add auth-microservice session verification, server-side RBAC, `/admin/api/session`, admin route protection, and viewer/operator/admin/owner mapping.
- Auth repository evidence confirmed `docs/CONSUMER_JWT_VALIDATION_STANDARD.md` approves the default browser-facing consumer pattern: server-side `POST /auth/validate` with `{ token }`, returning `valid: true` plus an Auth-owned user object and roles.
- Auth repository evidence confirmed `docs/UNIFIED_AUTH_CONTRACT.md` defines Auth as owner of identity, JWT shape, and RBAC role claims; current token/user payload includes `roles` as centralized RBAC role strings.
- Auth implementation evidence confirmed `src/auth/auth.controller.ts` exposes `POST /auth/validate`, and `src/auth/auth.service.ts` verifies the JWT with Auth `JWT_SECRET`, checks active user state, and returns sanitized user data plus roles.
- Auth implementation evidence confirmed `src/roles/roles.service.ts` emits full scoped role strings in the forms `global:<role>`, `app:<application-name>:<role>`, and `internal:<application-name>:<role>`.
- Auth seed evidence found current generic platform/internal roles such as `global:superadmin`, `global:platform_admin`, and `internal:marketing-microservice:admin`; `[MISSING: production assignment/seeding evidence for marketing_viewer and marketing_operator role grants]` remains for operations before broad admin rollout.

Implementation evidence:

- Added `src/admin-auth.ts` with server-side Auth session verification through `AUTH_SERVICE_URL` + `AUTH_SESSION_VALIDATE_PATH` defaulting to `/auth/validate`.
- Added server-side RBAC mapping for `viewer`, `operator`, `admin`, and `owner`, with configurable role env keys `MARKETING_ADMIN_VIEWER_ROLES`, `MARKETING_ADMIN_OPERATOR_ROLES`, `MARKETING_ADMIN_ADMIN_ROLES`, and `MARKETING_ADMIN_OWNER_ROLES`.
- Default RBAC mapping accepts recommended Marketing roles plus confirmed Auth scoped role formats; `global:superadmin` maps to owner, `global:platform_admin` and `internal:marketing-microservice:admin` map to admin.
- Added `src/admin-shell.ts` as a minimal protected admin shell renderer with navigation only; it does not implement campaign, segment, run, audit, analytics, or execution controls.
- Added protected `GET /admin` and `GET /admin/api/session` routes in `src/main.ts`; anonymous requests are rejected before shell/session data is returned.
- `/admin/api/session` returns sanitized user metadata, roles, and access level only; it does not return Auth tokens, `MARKETING_API_TOKEN`, `SERVICE_API_TOKEN`, provider credentials, message bodies, or recipient data.
- Added admin auth tests covering anonymous rejection, Auth validate calls, viewer/operator/admin/owner role mapping, configurable auth cookie support, and rejection of service tokens as browser identity.
- Added ignored local `.env.example` key documentation for the new auth/session/RBAC settings; the repository currently ignores `.env.example` via `.gitignore`.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 54 tests, 54 passing.
- New targeted contract tests passed:
  - `admin shell rejects anonymous browser requests`
  - `admin session is verified through auth and maps viewer operator admin owner roles`
  - `admin session supports configurable auth cookie and does not accept service tokens as browser identity`

Intent Compliance Report:

- Marketing did not become the identity, session, JWT, or RBAC role-claim authority; it validates Auth-owned user tokens server-side.
- Marketing did not expose service tokens to browser code or admin session responses.
- Marketing did not modify service-token protected API compatibility for existing machine consumers.
- Marketing did not add direct email, Telegram, or WhatsApp delivery and did not execute any real campaign or journey.
- Marketing did not take ownership of auth/leads contact data, preferences, consent, unsubscribe truth, provider credentials, channel registry behavior, tenant truth, CRM master data, or analytics truth.

Completed chunk:

- Goal 15 discovery plus isolated admin auth/RBAC shell foundation: anonymous admin rejection and server-side viewer/operator/admin/owner mapping.

Next unfinished step:

- Goal 15 follow-up: confirm/provision production Auth role grants for `marketing_viewer`, `marketing_operator`, `marketing_admin`, and `marketing_owner`, then integrate login/return-url handoff from Goal 14 before Goals 16, 17, and 18 admin UI tracks.

## 2026-06-13 - Goal 20 Governance Draft Discoverability Fix

Current focus: Goal 20 documentation integration correction.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- This correction changed documentation references only; it did not add enforcement code, notification sending behavior, auth/leads ownership changes, deployment, or real campaign execution.

Implementation evidence:

- Added `docs/agents/contracts/production-governance-readiness-contract.md` to the contract document list in `docs/agents/contracts/integration-api-matrix.md` so the Goal 20 policy contract is discoverable with the other integration contracts.
- Added documentation draft evidence under Goal 20 in `docs/orchestrator/GOALS.md`, linking the governance contract and production readiness playbook.
- Kept Goal 20 enforcement explicitly blocked by missing production risk thresholds, high-risk approver identities, quiet-hour policy defaults, and owner-approved deployment/rollback procedure instead of marking runtime enforcement complete.

Validation:

- Documentation review only; no runtime code changed.
- `npm run build`, `npm test`, deployment, and real campaign execution were not run.

Intent Compliance Report:

- The fix improves traceability without weakening campaign approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30, registry validation, notification delegation, or audit requirements.

## 2026-06-13 - Goal 19.3 CRM Account Runtime Client Blocked Evidence

Current focus: Goal 19 - CRM/Account Service Integration, chunk 19.3 readiness verification.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- CRM/account master data remains owned outside Marketing by a future or external CRM/account service.
- Marketing may use CRM/account lifecycle signals only as read-only segmentation inputs after the real source contract exists and is approved.
- CRM account lifecycle, opportunity, owner, health, onboarding, renewal, upsell, or winback state must never imply recipient consent.
- Reachable recipients must still resolve through auth/leads and all existing explicit approval, source-owned consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, and notification delegation gates must remain enforced.
- This session did not implement a runtime CRM client, CRM source type, CRM master-data migration, journey runtime change, admin UI, deployment, or real campaign execution.

Readiness verification evidence:

- Reviewed the mandatory orchestrator files and required CRM/account, integration, campaign, consent, and channel contracts before changing documentation.
- `docs/agents/contracts/crm-account-signal-contract.md` still marks CRM runtime work blocked until all required facts are available and approved.
- `docs/agents/contracts/integration-api-matrix.md` still identifies the CRM/account dependency as a future service and says runtime work is blocked until service URL, auth, endpoint, and sample responses are approved.
- `docs/orchestrator/PLAN.md` still limits Goal 19 runtime work to after a real CRM/account service contract exists.
- Repository search for `CRM`, `crm`, `CRM_ACCOUNT`, `crm_account`, `account-signals`, `account service`, `account signal`, and `opportunity` found only draft/ownership documentation and historical status references, not an approved runtime service contract.
- `.env.example` contains no `CRM_ACCOUNT_SERVICE_URL`, `CRM_ACCOUNT_SIGNAL_PATH`, CRM auth token key, CRM timeout, CRM pagination, or CRM rate-limit configuration.
- `k8s/configmap.yaml` contains configured URLs for auth, leads, logging, notifications, and tenant/app registry only; no CRM/account service URL or endpoint path is configured.
- `k8s/external-secret.yaml` contains DB, notification, marketing API, tenant/app registry, and JWT secret references only; no CRM/account service token or auth method is configured.
- `src/types.ts` still limits executable segment sources to `auth_users`, `leads`, `orders`, and `app_signals`; no CRM/account segment source exists.
- `src/sources.ts` contains executable clients for auth, leads, orders/catalog, and application signals only; no CRM/account read client, pagination handling, rate-limit handling, or error contract handling exists.

Blockers confirmed still unresolved:

- `[MISSING: CRM/account service base URL]`
- `[MISSING: CRM/account service auth method]`
- `[MISSING: CRM/account read endpoint path]`
- `[MISSING: CRM/account sample account signal response]`
- `[MISSING: CRM/account sample opportunity signal response]`
- `[MISSING: CRM/account pagination and rate-limit contract]`
- `[MISSING: CRM/account error response contract]`

Decision:

- Goal 19.3 remains blocked.
- No runtime CRM source client was added because the required source contract facts are still missing and the existing CRM signal contract explicitly forbids executable CRM runtime work until those facts exist.

Validation:

- Documentation/status review only.
- `npm run build` and `npm test` were not run because no runtime code, generated documentation, imports, tests, or configuration files were changed.
- No deployment was run.

Intent Compliance Report:

- Marketing did not take ownership of CRM/account master data, companies, opportunities, account owners, lifecycle state, health state, onboarding state, customer-success notes, account-contact relationships, contact data, consent, unsubscribe truth, notification provider execution, provider credentials, channel registry behavior, tenant/app registry truth, or analytics truth.
- Marketing did not infer consent from CRM/account state and did not create an executable path that could bypass auth/leads recipient resolution.
- Existing approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, and notification delegation gates remain unchanged.

Next unfinished step:

- Goal 19.3 can start only after an approved real CRM/account service contract supplies the base URL, auth method, read endpoint path, account sample response, opportunity sample response, pagination/rate-limit contract, and error response contract.

## 2026-06-13 - Goal 18 Analytics And Attribution Contract/Aggregation Foundation

Current focus: Goal 18 - Analytics And Attribution Dashboard, contract and read-only aggregation foundation.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- Marketing analytics may summarize Marketing-owned campaign definitions, run state, delivery decisions, suppression reasons, correlation IDs, and sanitized audit/outcome evidence.
- Notifications remains the owner of provider delivery truth. Auth and leads remain owners of contact, preference, consent, and unsubscribe truth. Domain apps, orders/catalog, CRM/account, and analytics/customer-insights services remain owners of their source facts and read models.
- This session did not add dashboard UI because Goal 15 is not conclusively marked complete and shared Goal 16/17 admin navigation is still integration-gated.
- This session did not change campaign execution behavior, journey scheduler behavior, notification provider implementation, auth/leads models, order/catalog truth models, CRM runtime behavior, deployment, or real campaign execution.

Implementation evidence:

- Added `src/analytics.ts` as a read-only analytics helper.
- Added `buildMarketingAnalyticsSummary` to aggregate existing Campaign and ExecutionRun records by tenant/app/brand/business/product-line/lifecycle/environment/campaign/segment/channel/time filters.
- Summary output distinguishes Marketing-owned outcome statuses: sent, skipped, failed, would_send, and queued.
- Summary output groups by channel, campaign, segment, lifecycle stage, and decision reason while preserving campaign family/lifecycle catalog metadata.
- Added optional externally supplied attribution facts for delivered, converted, and attributed_value counts/values. When no external facts are supplied, delivered/converted/value fields remain unavailable with `external_analytics_required` instead of being inferred by Marketing.
- Added `buildMarketingAnalyticsEvents` to create sanitized normalized facts for `marketing.campaign.run.recorded` and `marketing.recipient.outcome.recorded`.
- Normalized facts include stable campaign/run/idempotency/correlation/scope/recipient-reference fields and explicitly omit raw recipient addresses, message content, channel keys, provider credentials, service tokens, and notification-provider payloads.
- Extended `docs/agents/contracts/analytics-attribution-contract.md` with Goal 18 read-only aggregation, external attribution fact, normalized marketing fact, and dashboard UI gate sections.
- Added `test/analytics.test.ts` covering summary aggregation, external fact joins, and redaction of raw addresses/message content.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 62 tests, 62 passing.
- New targeted tests passed:
  - `analytics summary aggregates Marketing-owned outcomes without inventing attribution truth`
  - `analytics summary can join externally supplied attribution facts by campaign and run`
  - `analytics events redact raw recipient addresses and message content`
- Dashboard smoke/redaction tests were not run because no dashboard UI was changed.

Intent Compliance Report:

- Marketing did not become the owner of notifications delivery status, conversion truth, revenue/value truth, customer-insights read models, app behavior facts, order truth, catalog truth, CRM master data, contact data, consent, or unsubscribe state.
- Marketing did not infer delivered/converted/revenue facts from sent outcomes; those fields require externally supplied facts.
- Analytics helpers are read-only and do not execute campaigns, claim scheduler work, call notifications, resolve contacts, write source preferences, or bypass approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, notification delegation, or audit requirements.
- Browser admin UI remains blocked behind Goal 15/16/17 integration readiness.

Completed chunk:

- Goal 18 contract and read-only aggregation foundation for normalized Marketing facts and externally owned attribution joins.

Blocked next chunks:

- Goal 18 protected analytics dashboard UI remains blocked by `[MISSING: conclusive Goal 15 completion/reconciliation]` and `[MISSING: stable shared Goal 16/17 admin navigation integration]`.
- Goal 18 runtime analytics-service integration remains blocked by `[MISSING: approved analytics-service ingestion/read endpoint contract]`, `[MISSING: analytics-service auth method]`, and `[MISSING: delivery/conversion/value sample fact responses]`.


## 2026-06-13 - Goal 13.5 Journey Step Decision Audit Evidence

Current focus: Goal 13 - Lifecycle Journey Engine, chunk 13.5.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for journey definitions, due-step claims, scheduler decisions, campaign execution orchestration, idempotency evidence, and audit state.
- Notifications remains the only outbound provider executor; journey steps still delegate to the existing campaign executor and do not call provider APIs directly.
- Auth and leads remain owners of identity, contact data, preferences, consent, and unsubscribe truth; audit evidence stores decision summaries and source references only.
- This session did not execute a real campaign or journey against real recipients.

Implementation evidence:

- Added sanitized `journey_step_decision_audited` audit events from the journey scheduler after each claimed step completes or fails.
- Scheduler results now include `journeySteps.decisions` with per-step run status, recipient status counts, decision reason counts, sent/skipped/failed totals, due timestamp, deterministic idempotency key, step condition keys, max-executions metadata, and journey exit/suppression rule types.
- Added/finished persisted `decisionEvidence` on `JourneyStepClaim`, backed by `src/journey-audit.ts`, with journey approval/activation evidence, due timestamp, delay, idempotency key, condition keys, max-executions metadata, and exit/suppression rule references.
- Updated `migrations/0009_journey_step_scheduler_idempotency.sql` with `decision_evidence jsonb` for durable step decision evidence.
- Reconciled incomplete shared worktree code in `src/store.ts` by fixing PostgreSQL decision-evidence persistence and row mapping fallback.
- Added targeted test coverage: `journey scheduler emits sanitized step decision audit evidence`.
- Updated the journey contract with Goal 13.5 audit evidence behavior and redaction constraints.
- Marked Goal 13.5 complete and Goal 13 done in `docs/orchestrator/GOALS.md`; updated `STATE.json` and `docs/orchestrator/PLAN.md` to require coordinator selection/reconciliation for the next implementation chunk.

Validation:

- Remote `npm run build` passed.
- Remote targeted test `npx tsx --test --test-concurrency=1 test/executor.test.ts` passed: 32 tests, 32 passing.
- Remote `npm test` passed: 56 tests, 56 passing.

Intent Compliance Report:

- Delivery delegation preserved: yes, journey steps still call `executeCampaign`; no direct email, Telegram, WhatsApp, notification provider, or credential behavior was added.
- Approval gates preserved: yes, due step claims still require active approved journeys and campaign execution still requires approved executable campaigns for real delivery.
- Consent and unsubscribe enforcement preserved: yes, recipient decisions remain in the campaign executor and auth/leads remain source owners.
- Frequency caps, throttling, max-send, max-30 chunking, registry validation, and idempotency preserved: yes, audit evidence summarizes the existing campaign executor output instead of replacing it.
- Audit redaction preserved: yes, step decision evidence uses counts, reason summaries, rule references, IDs, and timestamps; it does not include message bodies, recipient addresses, authorization tokens, provider credentials, or notification-provider payloads.

Completed chunks:

- Goal 13.5 - Add audit evidence for step decisions.
- Goal 13 - Lifecycle Journey Engine is complete through chunks 13.1-13.5.

Next unfinished step:

- Coordinator reconciliation of existing Goal 14/15/19/20 parallel worktree evidence before assigning dependent Goal 16/17/18 work. Goal 14.3/14.4 remain blocked by missing auth URL, return URL, and admin route contracts.

## 2026-06-13 - Goal 13.5 Journey Step Decision Audit Evidence

Current focus: Goal 13 - Lifecycle Journey Engine, chunk 13.5.

Preserved intent and ownership boundary:

- Marketing owns journey definitions, journey step claims, scheduler decisions, campaign execution orchestration, idempotency evidence, and campaign audit state.
- Notifications remains the only outbound provider executor; no direct email, Telegram, WhatsApp, or provider calls were added.
- Auth and leads remain owners of identity, contact data, preferred channels, consent, preferences, and unsubscribe truth.
- Application, order, catalog, and source services remain read-only signal owners and were not changed.
- This session did not deploy and did not execute a real campaign or journey against real recipients.

Implementation evidence:

- Added sanitized journey step decision evidence for due step claims.
- Due journey step claims now record journey approval and activation snapshot, due timestamp, delay, campaign ID, deterministic journey idempotency key, condition key names, max-execution metadata, and exit or suppression rule references.
- Added persistent decision_evidence JSONB storage for marketing_journey_step_claims, including migration 0010_journey_step_decision_evidence.sql.
- Scheduler run-due now returns journey step decision summaries and emits journey_step_decision_audited with aggregate run status counts, decision reason counts, and rule metadata.
- Journey step execution still delegates to the campaign executor; campaign approval, recipient consent, unsubscribe, frequency caps, throttling, max-send, max-30 chunking, registry validation, idempotency, notification delegation, and recipient audit evidence remain in that path.
- Updated the Marketing campaign contract with the Goal 13.5 audit evidence shape and redaction boundary.
- Added test coverage for sanitized journey step decision audit evidence returned from the scheduler path.

Validation:

- Remote npm run build passed.
- Remote npm test passed: 56 tests, 56 passing.

Intent Compliance Report:

- Delivery delegation preserved: yes.
- Approval gates preserved: yes.
- Consent and unsubscribe ownership preserved: yes.
- Frequency caps, throttling, max-send, max-30 chunking, registry validation, and idempotency preserved: yes.
- Audit redaction preserved: yes; step evidence excludes message bodies, recipient addresses, provider credentials, authorization tokens, notification-provider payloads, and source-owned contact or preference truth.

Completed chunk:

- Goal 13.5 - Add audit evidence for step decisions.

Next unfinished step:

- Coordinator reconciliation of existing Goal 14/15/19/20 parallel worktree evidence before selecting the next implementation chunk.

## 2026-06-13 - Goal 14 Track B Public Landing And Auth Entry Evidence

Current focus: Goal 14 - Landing Page And Auth Entry Points, chunks 14.1-14.5 Track B evidence.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane and may present a public entry point only.
- Auth-microservice owns registration, login, user JWT/session validation, registered-user identity, contact data, consent, and preferences.
- Marketing public pages must not expose service tokens, campaign execution controls, recipient/contact data, admin data, provider credentials, or notification delivery behavior.
- Admin access remains protected by the Goal 15 admin shell route and auth-backed session validation.
- This session did not deploy and did not execute any real campaign or journey.

Auth contract discovery evidence:

- Reviewed auth-microservice docs/config for public entry points before wiring production-like links.
- Confirmed auth hosted entry points: `https://auth.alfares.cz/login` and `https://auth.alfares.cz/register`.
- Confirmed auth return contract: absolute HTTPS `return_url`, optional `client_id`, optional `state`, and token handoff via URL fragment on the return URL.
- Because URL fragments are browser-only, Marketing uses a public `/auth/callback` handoff page before redirecting to `/admin` instead of returning directly to the protected server-rendered admin route.

Implementation evidence:

- Added static public asset build copying through `scripts/copy-public.mjs` and `npm run build`, and copied `public`/`scripts` in the Docker builder stage.
- Added public static serving for `/assets`, `/`, and `/landing` from built `dist/public` when available, falling back to source `public` during development.
- Added the public landing page with Marketing capability positioning and links to `/auth/register`, `/auth/login`, `/admin`, and `/health`.
- Added `/auth/login` and `/auth/register` routes that set a short-lived `marketing_auth_state` cookie and redirect to auth-microservice with `return_url=https://marketing.alfares.cz/auth/callback`, `client_id=marketing-microservice`, and a generated state value.
- Added `/auth/callback` browser handoff page that validates returned state when present, stores only the Auth access token in the configured admin auth cookie path, does not store refresh tokens, clears the temporary state cookie, and redirects to `/admin`.
- Added public tests asserting the landing page exposes auth-owned entry points while excluding service-token strings and campaign execution controls, and asserting auth redirect URL/state/callback behavior.
- Added favicon metadata to avoid browser `/favicon.ico` 404 noise during rendered validation.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 56 tests, 56 passing.
- Rendered validation used Playwright fallback because the in-app Browser control tool was not available in this thread.
- Temporary built server validation target: `http://127.0.0.1:4614` forwarded to remote built `node dist/main.js` with in-memory store and auth public URL configuration.
- Desktop rendered validation passed at 1440x1000: title `Statex Marketing`, hero visible, `/auth/register`, `/auth/login`, and `/admin` links present, background PNG loaded with HTTP 200, no console errors/warnings, no detected horizontal overflow.
- Mobile rendered validation passed at 390x844 with the same checks and no console errors/warnings or detected overflow.
- Auth link interaction passed: clicking `Log in` navigated to `https://auth.alfares.cz/login?return_url=https%3A%2F%2Fmarketing.alfares.cz%2Fauth%2Fcallback&client_id=marketing-microservice&state=<uuid>` with auth origin mocked only for the browser screenshot.
- Callback page static validation passed: `/auth/callback` renders `Marketing Auth Handoff` and fails closed when no access token fragment is present.
- Screenshot evidence captured outside the repo: `/private/tmp/marketing-landing-desktop-auth.png`, `/private/tmp/marketing-landing-mobile-auth.png`, `/private/tmp/marketing-login-redirect-auth.png`, `/private/tmp/marketing-auth-callback-static.png`.

Intent Compliance Report:

- Service-token boundary preserved: yes, no public page or browser route exposes `MARKETING_API_TOKEN`, service bearer tokens, `x-service-token`, provider credentials, or backend service-token handling.
- Campaign execution boundary preserved: yes, public pages expose no execute, scheduler, run-due, approval mutation, delivery, or admin campaign operation controls.
- Auth ownership preserved: yes, register/login are delegated to auth-microservice; Marketing only builds return URLs and consumes an Auth user access token for admin session handoff.
- Contact/consent ownership preserved: yes, the public landing and callback do not expose contact data, recipient data, preferences, consent truth, or unsubscribe state.
- Delivery ownership preserved: yes, no direct email, Telegram, WhatsApp, notification provider, or notification service behavior was added.
- Admin boundary preserved: yes, `/admin` remains protected by auth-backed admin session validation from Goal 15; the public landing only links to it.

Completed Track B chunks with evidence:

- Goal 14.1 - frontend/static build pipeline and static serving.
- Goal 14.2 - public Marketing landing page.
- Goal 14.3 - register, login, admin, and status entry links.
- Goal 14.4 - auth-microservice login/register redirect and callback handoff.
- Goal 14.5 - static asset build/test/render validation evidence; production deployment was not run.

Next unfinished step:

- Coordinator should reconcile Goal 14 Track B evidence with Goal 15 admin shell evidence, then update the Goal 14 checklist and decide whether production deployment is approved.

## 2026-06-13 - Goal 20 Documentation Closeout And Enforcement Blockers

Current focus: Goal 20 - Production Governance And Readiness, documentation closeout only.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign risk classification, approval evidence, readiness checks, policy references, operational audit state, and production run governance.
- Notifications remains the only outbound provider executor; this session did not add provider calls, provider credentials, or direct sending behavior.
- Auth and leads remain the owners of identity, contact data, consent, preferences, and unsubscribe truth.
- Tenant/app/business registry or another explicitly approved policy source remains the owner of tenant/app timezone, policy reference, and canonical policy truth.
- This session did not deploy and did not execute any real campaign or journey against real recipients.

Implementation evidence:

- Reviewed the mandatory orchestrator files and Goal 20 governance/readiness docs in the remote repository.
- Closed the documentation portion of Goal 20 by marking chunks 20.1-20.5 as completed policy/playbook drafts in `docs/orchestrator/GOALS.md`.
- Added a follow-up runtime enforcement chunk, 20.6, to make clear that code enforcement is not complete and must wait for approved production policy facts plus admin/runtime dependencies.
- Updated `STATE.json` metrics with Goal 20 documentation closeout and blocked enforcement status only; coordinator-wide stage and next-focus fields were left unchanged.

Blocked enforcement facts:

- [MISSING: production recipient-count thresholds for low, standard, high, and restricted classes]
- [MISSING: high-risk business approver identity source]
- [MISSING: governance/operations approver identity source]
- [MISSING: policy owner for restricted campaign exceptions]
- [MISSING: quiet-hour weekend/holiday defaults]
- [MISSING: channel-specific quiet-hour defaults for email, telegram, and whatsapp]
- [MISSING: emergency override approver and expiry rules]
- [MISSING: confirmed rollback command/version policy]

Validation:

- Documentation review against `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/agents/contracts/production-governance-readiness-contract.md`, `docs/operations/production-readiness-playbook.md`, `docs/agents/contracts/marketing-campaign-contract.md`, `docs/agents/contracts/preferences-consent-contract.md`, `docs/agents/contracts/channel-registry-contract.md`, and `docs/agents/contracts/integration-api-matrix.md`.
- `npm run build` and `npm test` were not run because this session changed only orchestrator/governance documentation and `STATE.json` metadata.
- No deployment was run; production deployment remains blocked without explicit owner approval.

Intent Compliance Report:

- Goal 20 documentation strengthens approval, audit, quiet-hour/risk controls, unsubscribe escalation, deployment readiness, rollback, and incident processes without bypassing campaign safety gates.
- Existing campaign approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, notification delegation, and audit requirements remain unchanged.
- No notification provider implementation, auth/leads source-of-truth model, direct sending behavior, campaign execution weakening, or admin UI implementation was added.

Next unfinished step:

- Owner must confirm the missing production policy facts before enforcement code, admin governance controls, production deployment, or real campaign execution.

## 2026-06-13 - Goal 19 CRM Account Runtime Readiness Recheck

Current focus: Goal 19 - CRM/Account Service Integration, chunk 19.3 runtime readiness and smallest safe client eligibility.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- CRM/account data is read-only segmentation signal input only.
- Marketing must not own CRM/account master data, account/contact relationships, opportunity state, account lifecycle state, contact data, consent, unsubscribe, or preferred-channel truth.
- CRM/account lifecycle, opportunity, owner, health, onboarding, renewal, upsell, or winback state must never imply recipient consent.
- Reachable recipients must still resolve through auth/leads before any real campaign execution, and all existing explicit approval, source-owned consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, and notification delegation gates must remain enforced.

Readiness verification evidence:

- Read the mandatory orchestrator files and required campaign, consent, channel, integration, and CRM/account contracts before changing status documentation.
- `docs/agents/contracts/crm-account-signal-contract.md` still states that Goal 19.1-19.2 are contract drafts only and that no runtime CRM client or executable CRM segment source is approved until all runtime facts exist and are approved.
- `docs/agents/contracts/integration-api-matrix.md` still identifies the CRM/account service as a future dependency and says runtime work is blocked until service URL, auth, endpoint, and sample responses are approved.
- `docs/orchestrator/PLAN.md` still limits Goal 19 runtime work to after a real CRM/account service contract exists.
- The dirty worktree at session start already contained uncommitted executable CRM/runtime surface: `src/api-contracts.ts` accepts `crm_accounts`, `src/types.ts` includes `crm_accounts`, `src/sources.ts` contains a `CRM_ACCOUNT_SERVICE_URL` client path, `.env.example` contains CRM account keys, and `test/executor.test.ts` contains CRM account runtime tests.
- Those uncommitted runtime changes were not treated as approved Goal 19.3 completion because the source contract still forbids executable runtime work until the missing facts are approved.
- Repository/config search found no production runtime CRM/account base URL, no configured Kubernetes CRM/account URL or endpoint, no approved auth method beyond the draft token placeholder, and no approved external error/rate-limit contract outside the draft document and tests.

Blockers confirmed still unresolved:

- `[MISSING: CRM/account service base URL]`
- `[MISSING: CRM/account service auth method]`
- `[MISSING: CRM/account read endpoint path]`
- `[MISSING: CRM/account sample account signal response]`
- `[MISSING: CRM/account sample opportunity signal response]`
- `[MISSING: CRM/account pagination and rate-limit contract]`
- `[MISSING: CRM/account error response contract]`

Decision:

- Goal 19.3 remains blocked.
- No additional runtime CRM source client work was performed in this session.
- The existing dirty runtime edits require coordinator reconciliation before merge: either obtain the approved CRM/account service contract facts and mark the runtime path in-scope, or keep executable CRM source support out of the integration branch until those facts exist.

Validation:

- `npm run build` passed on the current remote dirty tree.
- `npm test` passed on the current remote dirty tree: 56 tests, 56 pass, 0 fail.
- No deployment was run.
- No real campaign execution was run.

Intent Compliance Report:

- This session did not take ownership of CRM/account master data, companies, opportunities, account owners, lifecycle state, health state, onboarding state, customer-success notes, account-contact relationships, auth/leads contact data, consent, unsubscribe truth, notification provider execution, provider credentials, channel registry behavior, tenant/app registry truth, or analytics truth.
- This session did not infer consent from CRM/account state and did not add any new executable path that bypasses auth/leads recipient resolution.
- Existing approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, and notification delegation gates remain unchanged by this session.

Next unfinished step:

- Goal 19.3 can start only after an approved real CRM/account service contract supplies the base URL, auth method, read endpoint path, account sample response, opportunity sample response, pagination/rate-limit contract, and error response contract.

## 2026-06-13 - Goal 17 Dependency Gate Review

Current focus: Goal 17 - Runs, Consent, Channels, And Audit Admin Views, dependency gate review only.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane and may display only Marketing-owned run, outcome, delivery-decision, consent-enforcement, frequency-cap, throttling, and audit state after admin protection is complete.
- Auth remains the source of truth for registered-user identity, contact data, preferred channels, consent, preferences, JWT/session validation, and RBAC role claims.
- Leads remains the source of truth for lead identity, contact data, preferred channels, consent, preferences, and unsubscribe truth.
- Notifications remains the source of truth for channel registry behavior, outbound provider execution, provider credentials, and provider delivery internals.
- Goal 17 views must not expose provider credentials, message bodies, service tokens, authorization headers, notification-provider payloads, recipient addresses, or source-owned contact/preference truth.

Dependency verification evidence:

- Read the mandatory orchestrator and contract files for this session: `BUSINESS.md`, `SYSTEM.md`, `README.md`, `TASKS.md`, `STATE.json`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/STATUS.md`, `docs/orchestrator/PROMPTS.md`, `docs/agents/contracts/integration-api-matrix.md`, `docs/agents/contracts/marketing-campaign-contract.md`, `docs/agents/contracts/preferences-consent-contract.md`, and `docs/agents/contracts/channel-registry-contract.md`.
- `docs/orchestrator/GOALS.md` still records Goal 15 - Admin Auth And RBAC Shell as `pending` and Goal 17 as `pending`.
- `TASKS.md` still records TG-3.8 Goal 15 and TG-3.10 Goal 17 as pending.
- `STATE.json` still sets the next focus to coordinator reconciliation of parallel Goal 14/15/19/20 worktree evidence and does not mark Goal 15 complete.
- `docs/orchestrator/PLAN.md` states that Goal 16 and Goal 17 should wait for Goal 15 admin auth/RBAC shell reconciliation because they expose protected operational data and controls.
- Existing `STATUS.md` evidence shows Goal 15 added an isolated admin auth/RBAC shell foundation with anonymous rejection, Auth-backed session validation, `/admin/api/session`, and targeted tests, but its next unfinished step remains: confirm/provision production Auth role grants for `marketing_viewer`, `marketing_operator`, `marketing_admin`, and `marketing_owner`, then integrate login/return-url handoff before Goals 16, 17, and 18 admin UI tracks.
- Existing `STATUS.md` evidence shows Goal 14 later added login/register redirect and callback handoff, but the next unfinished step remains coordinator reconciliation of Goal 14 Track B evidence with Goal 15 admin shell evidence.

Blocker decision:

- Goal 17 is blocked and was not implemented in this session because the upstream Goal 15 dependency is not conclusively complete in the orchestrator sources of truth.
- The specific blocker is `[MISSING: coordinator reconciliation marking Goal 15 complete and confirming production Auth role-grant readiness for protected admin operational views]`.
- No run, consent, channel, audit, correlation-search, route handler, redaction helper, test, campaign execution, notification provider, auth/leads source-owner, journey scheduler, CRM runtime, or shared admin layout files were changed.

Validation:

- No build or test command was run because no application code was changed and Goal 17 implementation was intentionally blocked at the dependency gate.
- Remote working tree already contained unrelated in-progress changes from other agents; this session appended only this blocker evidence to `docs/orchestrator/STATUS.md`.

Intent Compliance Report:

- Marketing did not expose protected operational data before the admin authorization dependency was conclusively complete.
- Marketing did not duplicate auth/leads consent, contact, identity, preference, or unsubscribe ownership.
- Marketing did not expose notification channel provider credentials or provider execution internals.
- Marketing did not add direct email, Telegram, WhatsApp, notification provider calls, campaign execution changes, scheduler changes, CRM runtime code, or real campaign execution.

Next unfinished step:

- Coordinator/integration owner must reconcile Goal 14 and Goal 15 evidence, update the canonical goal/task/state sources if Goal 15 is complete, and explicitly release Goal 17 before admin operational views are implemented.

## 2026-06-13 - Goal 19.3 CRM Account Signal Source Client

Current focus: Goal 19 - CRM/Account Service Integration, chunk 19.3.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- CRM/account master data remains owned outside Marketing by a future or external CRM/account service.
- Because no CRM/account repository or deployed service contract was discoverable under `/home/ssf/Documents/Github`, Marketing generated the consumer-side read contract and shipped the runtime client disabled by default.
- Production CRM/account source use requires `CRM_ACCOUNT_SERVICE_URL`; there is no source-code default base URL and no Kubernetes CRM URL was added.
- CRM account lifecycle, opportunity, owner, health, onboarding, renewal, upsell, or winback state does not imply recipient consent.
- CRM `contactRefs` are relationship references only; reachable recipients still resolve through auth/leads and all existing explicit approval, source-owned consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, and notification delegation gates remain enforced.
- This session did not add CRM master-data migrations, journey runtime changes, admin UI, notification provider implementation, auth/leads source-of-truth models, deployment, or real campaign execution.

Implementation evidence:

- Added `crm_accounts` as a supported read-only segment source in `src/types.ts` and `src/api-contracts.ts`.
- Added CRM/account source env keys to `.env.example`: `CRM_ACCOUNT_SERVICE_URL`, `CRM_ACCOUNT_SERVICE_TOKEN`, `CRM_ACCOUNT_SIGNAL_PATH`, `CRM_ACCOUNT_SIGNAL_LIMIT`, `CRM_ACCOUNT_SIGNAL_MAX_PAGES`, and `CRM_ACCOUNT_SIGNAL_TIMEOUT_MS`.
- Added a read-only CRM/account signal client in `src/sources.ts` using `GET {CRM_ACCOUNT_SERVICE_URL}{CRM_ACCOUNT_SIGNAL_PATH:-/marketing/account-signals}`.
- The client sends tenant/app/brand scope plus account, company, owner, opportunity, lifecycle, health, onboarding, renewal, and source-updated predicates derived from segment rules.
- The client validates `marketing.crm_account_signal.v1` and `marketing.crm_opportunity_signal.v1` envelopes, tenant/app scope, required source IDs, and ISO `sourceUpdatedAt` before using a signal.
- The client supports bounded cursor pagination using `CRM_ACCOUNT_SIGNAL_LIMIT` and `CRM_ACCOUNT_SIGNAL_MAX_PAGES`, defaulting to one page.
- The client reads only relationship `contactRefs` and converts `auth:user:*` and `leads:lead:*` references into candidate recipient refs; it ignores raw addresses and does not create contact records.
- CRM account signals filter recipients already resolved through auth/leads; notification delivery still goes through the existing campaign executor path.
- Missing CRM configuration, source errors, malformed envelopes, no source signals, no matching accounts, or no resolvable contact refs fail/skip safely before notification delegation with `crm_account_*` evidence.
- Updated `docs/agents/contracts/crm-account-signal-contract.md` with the generated runtime contract facts, auth method, endpoint path, pagination/rate-limit behavior, timeout, and error response shape.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` and `docs/agents/contracts/integration-api-matrix.md` to document `crm_accounts` source behavior and production configuration requirements.
- Marked Goal 19.3 complete in `docs/orchestrator/GOALS.md`; Goal 19.4 and Goal 19.5 remain open for B2B account segment rules/blueprints and broader audit evidence.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 59 tests, 59 passing.
- New targeted tests passed:
  - `filters recipients through read-only crm account signals`
  - `fails crm account signal source safely without notification delivery`
  - `segment contract accepts crm account signal source`

Intent Compliance Report:

- Marketing did not take ownership of CRM/account master data, companies, opportunities, account owners, lifecycle state, health state, onboarding state, customer-success notes, account-contact relationships, contact data, consent, unsubscribe truth, notification provider execution, provider credentials, channel registry behavior, tenant/app registry truth, or analytics truth.
- CRM/account state is used only as a read-only segmentation input and recipient filter.
- Marketing does not infer consent from CRM/account state and does not use CRM raw contact data for delivery.
- Existing approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, and notification delegation gates remain unchanged and covered by the existing executor path.

Next unfinished step:

- Goal 19.4 - Add B2B account segment rules and campaign blueprints, using only the generated read-only `crm_accounts` source contract and without adding CRM master-data ownership to Marketing.

## 2026-06-13 - Final Integration Reconciliation For Goals 14/15/16/17/18/19/20

Current focus: final integration owner for the parallel Goal 14/15/16/17/18/19/20 workstreams.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign definitions, segment definitions, execution decisions, consent/frequency enforcement, approvals, throttling, and audit state.
- Notifications remains the only outbound provider executor and channel registry owner.
- Auth remains the identity, JWT/session, registered-user contact, preference, and consent owner.
- Leads remains the lead identity, contact, preference, and consent owner.
- Domain/app/CRM/analytics services remain source owners for their facts; Marketing stores references, campaign decisions, and audit evidence only.
- This integration did not deploy and did not execute a real campaign or journey against real recipients.

Worker evidence reconciled:

- Goal 14 Track B completed chunks 14.1-14.5: static build/serving, anonymous landing page, auth-owned register/login/admin/status entry points, auth redirect/callback handoff, and rendered validation evidence.
- Goal 15 Track C completed chunks 15.1-15.5: Auth session validation through auth-microservice, server-side viewer/operator/admin/owner RBAC mapping, protected /admin and /admin/api/session, admin shell navigation, and unauthorized/role contract tests.
- Goal 16 produced no implementation handoff in this integration window and remains ready only after the current integration worktree is reviewed/committed.
- Goal 17 produced no implementation handoff in this integration window and remains ready only after the current integration worktree is reviewed/committed.
- Goal 18 produced no implementation handoff in this integration window; Goal 18.1/18.2 contract/event work can start after commit if isolated, while dashboard UI remains dependency-gated by admin navigation and analytics contract ownership.
- Goal 19 completed contract chunks 19.1-19.2 and remains blocked for runtime work by missing CRM/account service URL, auth method, read endpoints, sample responses, pagination/rate-limit contract, and error contract.
- Goal 20 completed policy/playbook drafts for 20.1-20.5 and remains blocked for enforcement by missing production risk thresholds, high-risk approver identities, quiet-hour defaults, owner-approved deployment/rollback procedure, and production Auth role grant evidence.

Reconciliation changes:

- Marked Goal 14 done with chunks 14.1-14.5 complete in docs/orchestrator/GOALS.md.
- Marked Goal 15 done with chunks 15.1-15.5 complete in docs/orchestrator/GOALS.md, while keeping production Auth role grants as an operations blocker before broad rollout.
- Marked Goal 19 blocked after 19.1-19.2 contract drafts.
- Marked Goal 20 blocked after 20.1-20.5 governance/readiness drafts pending owner-approved policy facts.
- Updated TASKS.md, STATE.json, and docs/orchestrator/PLAN.md with the next parallel launch order and remaining blockers.

Validation:

- Remote npm run build passed on the integrated tree: tsc -p tsconfig.json && node scripts/copy-public.mjs.
- Remote npm test passed on the integrated tree: 56 tests, 56 passing.
- Test coverage includes public auth entry points, protected API service auth, admin anonymous rejection, Auth-backed session validation and RBAC mapping, campaign catalog, public preferences/unsubscribe, registry validation, journey scheduler/audit, executor safety gates, source failure behavior, and persistence coverage.
- Existing test output includes expected audit_log_forward_failed messages for unavailable logging-microservice in the test environment; tests still pass and no delivery-provider execution was added.

Remaining blockers:

- [MISSING: production Auth role grant evidence for marketing_viewer, marketing_operator, marketing_admin, and marketing_owner].
- [MISSING: CRM/account service base URL].
- [MISSING: CRM/account service auth method].
- [MISSING: CRM/account read endpoint path].
- [MISSING: CRM/account sample account and opportunity responses].
- [MISSING: CRM/account pagination/rate-limit and error contracts].
- [MISSING: approved analytics/conversion owner contract] for attribution beyond Marketing-owned campaign facts.
- [MISSING: production risk thresholds].
- [MISSING: high-risk approver identities].
- [MISSING: quiet-hour policy defaults].
- [MISSING: owner-approved deployment/rollback procedure].

Integration order for next wave:

1. Review and commit the current remote integration worktree.
2. Launch Goal 18.1/18.2 analytics contract/event work if isolated from admin UI files.
3. Launch Goal 16 and Goal 17 admin UI tracks with explicit shared navigation ownership and merge order.
4. Run final integration validation after Goal 16/17/18 merge: remote npm run build, npm test, rendered admin checks, unauthorized access checks, browser token non-exposure checks, and redaction checks.
5. Keep Goal 19 runtime and Goal 20 enforcement blocked until the missing source/policy facts are supplied and approved.

Intent Compliance Report:

- Delivery delegation preserved: yes; no direct email, Telegram, WhatsApp, provider, or notification credential behavior was added.
- Auth ownership preserved: yes; Marketing delegates login/register to auth-microservice and validates Auth-owned browser tokens server-side.
- Browser service-token boundary preserved: yes; admin session responses and public pages do not expose MARKETING_API_TOKEN, SERVICE_API_TOKEN, x-service-token, provider credentials, or authorization headers.
- Contact/consent ownership preserved: yes; Marketing did not create source-of-truth contact, preference, consent, unsubscribe, CRM, tenant, app, analytics, or channel registry records.
- Real execution safety preserved: yes; no real campaign or journey execution was triggered, and existing approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, registry validation, notification delegation, and audit gates remain covered by tests.

## 2026-06-13 - Goal 19.3 Post-Reconciliation Status Correction

Current focus: reconcile the latest Goal 19.3 implementation after the earlier integration note that still listed CRM runtime work as blocked.

Evidence:

- Goal 19.3 is no longer blocked for a Marketing-side runtime client.
- Marketing now has a generated-contract, disabled-by-default `crm_accounts` source client in `src/sources.ts`.
- Production use still requires real deployment configuration through `CRM_ACCOUNT_SERVICE_URL` and optional CRM account env keys; no source-code base URL or Kubernetes CRM URL was added.
- Goal 19.4 and Goal 19.5 remain open.

Validation:

- Remote `npm run build` passed.
- Remote `npm test` passed: 59 tests, 59 passing.

Intent Compliance Report:

- Marketing still does not own CRM/account master data, contact truth, consent truth, unsubscribe truth, notification provider execution, provider credentials, tenant/app registry truth, or analytics truth.
- CRM/account signals are read-only recipient filters; reachable recipients still resolve through auth/leads and all existing execution safety gates remain enforced.

## 2026-06-13 - Final Integration Correction For Goal 18 Analytics Evidence

Current focus: correction to final integration reconciliation after Goal 18 analytics files were found without a matching STATUS handoff entry.

Integrated evidence:

- Added src/analytics.ts with normalized Marketing-owned run and recipient outcome event builders.
- Added externally supplied attribution fact joining for delivered, converted, and attributed value summaries by campaign/run/correlation reference.
- Added analytics summary buckets by campaign, channel, segment, lifecycle stage, and decision reason from existing Marketing-owned campaign/run/outcome state.
- Added test/analytics.test.ts covering summary aggregation, externally supplied attribution facts, and redaction of raw recipient addresses, message content, and channelKey/provider-like values.

Reconciliation decision:

- Marked Goal 18 active with chunks 18.1 and 18.2 complete.
- Left Goal 18.3, 18.4, and 18.5 open because campaign attribution metadata, persisted/API read-model or analytics-service integration, dashboard charts, and exportable summaries are not complete.
- Updated TASKS.md, STATE.json, and docs/orchestrator/PLAN.md so the next wave launches Goal 18 follow-up work only after this integrated remote worktree is reviewed/committed.

Intent Compliance Report:

- Marketing emits and aggregates Marketing-owned campaign facts only; conversion and attributed value remain externally supplied facts.
- Analytics output does not include raw recipient addresses, message bodies, provider credentials, service tokens, or notification provider payloads.
- Marketing did not become the owner of analytics/customer-insights read models, app behavior truth, revenue truth, auth/leads contact data, consent truth, or notification delivery.

## 2026-06-13 - Final Integration Validation Closeout

Current focus: final validation closeout after reconciling late Goal 18 and Goal 19.3 evidence.

Final reconciled state:

- Goal 14 is complete through 14.1-14.5.
- Goal 15 is complete through 15.1-15.5; production Auth role grants still need operations evidence before broad rollout.
- Goal 18 is active with 18.1 and 18.2 complete; 18.3-18.5 remain open.
- Goal 19 is active with 19.1, 19.2, and 19.3 complete; 19.4-19.5 remain open and production CRM/account use remains gated by source-service configuration/readiness.
- Goal 20 is blocked for runtime enforcement pending owner-approved production policy facts.
- Goal 16 and Goal 17 produced no implementation handoff and should launch only after the current integrated remote worktree is reviewed/committed.

Final validation:

- Remote npm run build passed: tsc -p tsconfig.json && node scripts/copy-public.mjs.
- Remote npm test passed: 62 tests, 62 passing.
- The final suite includes analytics event/redaction tests, public landing/auth handoff tests, admin auth/RBAC tests, protected API authorization tests, campaign catalog tests, preference/unsubscribe tests, registry validation tests, journey scheduler/audit tests, executor safety tests, CRM account signal source tests, and persistence tests.
- Test logs include expected audit_log_forward_failed messages for unavailable logging-microservice in the test environment; those are non-failing safe-failure logs.

Intent Compliance Report:

- Marketing remains the campaign and segmentation control plane.
- Marketing did not add direct notification provider execution or provider credentials.
- Marketing did not become auth/leads/CRM/analytics source of truth.
- Browser-facing routes do not expose service tokens.
- No deployment and no real campaign or journey execution were performed.


## 2026-06-13 - Goal 14/15 Reconciliation And Admin Shell Completion Review

Current focus: Goal 14 public landing/auth entry and Goal 15 admin auth/RBAC shell reconciliation.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign, segment, journey, run, safety-decision, and audit state.
- Auth remains the owner of browser identity, registration, login, JWT/session validation, and RBAC role claims.
- Notifications remains the owner of outbound provider execution and channel registry behavior.
- Auth/leads remain owners of contact data, preferences, consent, and unsubscribe truth.
- This reconciliation did not change journey scheduler/runtime files, campaign execution logic, notification provider implementation, auth/leads source-of-truth models, analytics dashboards, deployment, or real campaign execution.

Reconciliation evidence:

- Reviewed the mandatory orchestrator files and required integration, campaign, consent, and channel contracts before changing code.
- Confirmed existing Goal 14 evidence covers public static serving, landing page, auth-owned login/register redirects, `/auth/callback` handoff, `/admin` entry link, token non-exposure checks, rendered desktop/mobile validation, remote `npm run build`, and remote `npm test`.
- Confirmed existing Goal 15 evidence covers auth-microservice session verification, server-side viewer/operator/admin/owner RBAC mapping, `/admin/api/session`, admin shell, service-token rejection as browser identity, and role-specific tests.
- Completed the smallest safe remaining Goal 15 shell gap by protecting the existing admin navigation namespaces `/admin/campaigns`, `/admin/segments`, `/admin/journeys`, `/admin/runs`, `/admin/audit`, and `/admin/settings` as inert authenticated shell placeholders.
- The new placeholders render no campaign/segment/run/audit feature UI and expose no operational controls; they only reserve protected admin route shape for later Goal 16, Goal 17, and Goal 18 work.
- Updated `docs/orchestrator/GOALS.md` to mark Goal 14 chunks 14.1-14.5 and Goal 15 chunks 15.1-15.5 complete.
- Updated `STATE.json` to record Goal 14 and Goal 15 completion and make coordinator selection of dependent UI tracks the next focus.

Validation:

- Remote `npm run build` passed on 2026-06-13.
- Remote `npm test` passed on 2026-06-13: 63 tests, 63 passing.
- New targeted test passed: `admin shell protects navigation placeholders without exposing operational controls`.

Intent Compliance Report:

- Public landing boundary preserved: yes, public routes expose no `MARKETING_API_TOKEN`, `SERVICE_API_TOKEN`, `x-service-token`, campaign execution controls, scheduler controls, provider credentials, admin data, recipient data, contact data, consent truth, or unsubscribe truth.
- Auth ownership preserved: yes, register/login remain delegated to auth-microservice and admin sessions are verified through auth-owned tokens/roles server-side.
- Service-token boundary preserved: yes, browser admin identity still does not accept Marketing service tokens and `/admin/api/session` returns sanitized session metadata only.
- RBAC boundary preserved: yes, viewer/operator/admin/owner access is mapped server-side from auth-owned role claims.
- Delivery boundary preserved: yes, no email, Telegram, WhatsApp, notification provider, or notifications channel registry behavior was added.
- Campaign safety preserved: yes, no approval, dry-run, execution, scheduler, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, or max-30 chunking behavior was weakened.

Completed chunks:

- Goal 14.1 - frontend/static build pipeline and static serving.
- Goal 14.2 - public Marketing landing page.
- Goal 14.3 - register, login, admin, and status entry links.
- Goal 14.4 - auth-microservice login/register redirects and callback handoff.
- Goal 14.5 - static asset build/test/render validation evidence; production deployment was not run.
- Goal 15.1 - auth session verification with auth-microservice.
- Goal 15.2 - viewer/operator/admin/owner role mapping.
- Goal 15.3 - `/admin/api/session` and protected admin route namespace.
- Goal 15.4 - admin layout shell and navigation.
- Goal 15.5 - unauthorized, role-specific, service-token rejection, and placeholder route tests.

Next unfinished step:

- Coordinator can assign Goal 16, Goal 17, and Goal 18 UI work on top of the protected admin shell with disjoint file ownership and explicit integration order. Production deployment and production Auth role provisioning still require owner/operator approval.

## 2026-06-13 - Goal 16 Campaign And Segment Admin Console Chunk

Current focus: Goal 16 - Campaign And Segment Admin Console, smallest safe chunk after Goal 15 verification.

Goal 15 dependency verification:
- Verified `docs/orchestrator/STATUS.md` contains Goal 15 Track C evidence for `src/admin-auth.ts`, `src/admin-shell.ts`, protected `GET /admin`, protected `GET /admin/api/session`, Auth-backed session verification, viewer/operator/admin/owner RBAC mapping, anonymous rejection, and no browser service-token exposure.
- Verified code evidence exists in `src/admin-auth.ts`, `src/admin-shell.ts`, and `src/main.ts`.
- Verified tests cover anonymous admin rejection, Auth validate calls, role mapping, configurable auth cookie support, and rejection of service tokens as browser identity.
- Remaining Goal 15 operational note still applies: [MISSING: production assignment/seeding evidence for marketing_viewer and marketing_operator role grants]. This did not block the smallest Goal 16 implementation because server-side RBAC contracts and tests are present.

Implemented Goal 16 chunk:
- Added `src/admin-campaign-segment-console.ts` with protected campaign and segment admin pages at `/admin/campaigns` and `/admin/segments`.
- Added protected admin APIs in `src/main.ts`:
  - `GET /admin/api/campaigns` for authenticated viewer+ campaign definition listing.
  - `GET /admin/api/segments` for authenticated viewer+ segment definition listing.
  - `POST /admin/api/campaigns/:id/dry-run` for operator+ dry-run summaries through the existing campaign executor with `dryRun: true`.
  - `POST /admin/api/campaigns/:id/approve` for admin+ explicit approval evidence using the authenticated admin actor.
- Dry-run admin responses return aggregate summaries only and do not expose recipient addresses.
- Real campaign execution was intentionally not added to the admin console.
- Did not edit `src/admin-shell.ts`; existing shared admin shell routes were left intact, and `src/main.ts` excludes `/admin/campaigns` and `/admin/segments` from the generic placeholder handler so the Goal 16 pages are not shadowed.
- Updated `test/api-contracts.test.ts` to cover RBAC, protected campaign/segment admin APIs, rendered campaign/segment page smoke, no service-token exposure, no direct execution/scheduler controls, sanitized dry-run summaries, and admin approval evidence.

Validation evidence:
- `npm run build` passed on remote repository `/home/ssf/Documents/Github/marketing-microservice`.
- `npm test` passed on remote repository `/home/ssf/Documents/Github/marketing-microservice`: 64 tests passed, 0 failed.
- Rendered/admin access smoke is covered by the passing `admin campaign and segment console APIs are protected by RBAC and return sanitized dry-run summaries` test, including `/admin/campaigns` and `/admin/segments` HTML checks.

Parallel execution / integration notes:
- Write scope was limited to Goal 16 campaign/segment admin files, admin route handlers, tests, and this append-only status entry.
- Shared admin layout file `src/admin-shell.ts` was not edited because Goal 17/18 may depend on it.
- The remote worktree already contained unrelated uncommitted changes from other agents; this session did not revert or overwrite them.
- Goal 17 and Goal 18 should avoid changing `src/main.ts` admin route ordering without checking the Goal 16 `/admin/campaigns` and `/admin/segments` handlers.

Intent Compliance Report:
- Marketing remains the campaign and segmentation control plane: the UI lists Marketing-owned campaign and segment definitions, records approval evidence, and invokes dry-run orchestration only.
- Marketing did not become the identity/session/RBAC source of truth; admin access still validates Auth-owned sessions server-side through Goal 15 admin auth.
- Marketing did not send messages directly and did not add notification provider execution.
- The admin UI does not expose `MARKETING_API_TOKEN`, `SERVICE_API_TOKEN`, authorization headers, provider credentials, recipient addresses, source-owned contact/preference truth, direct execution controls, or scheduler controls.
- Dry-run uses the existing campaign executor with `dryRun: true`; it does not call notifications or record sent history.
- Real delivery remains behind existing backend approval, consent, unsubscribe, frequency-cap, throttling, max-send, max-30 chunking, idempotency, registry validation, and notification delegation gates.
- No journey scheduler/runtime files, notification provider implementation, auth/leads source-of-truth models, CRM runtime client files, analytics dashboard files, or direct execution bypasses were changed by this Goal 16 session.


## 2026-06-14 - Marketing Gating Optimization Review

Current focus: reduce blocked/idle Marketing worker threads by making Goal 15 the explicit prerequisite gate before Goal 16/17/18 protected UI work.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign, segment, journey, run, decision, consent-enforcement, throttling, and audit state.
- Auth remains the owner of browser identity, registration, login, token/session validation, and role claims; Marketing validates Auth-owned session evidence server-side only.
- Notifications remains the owner of outbound provider execution and channel registry behavior.
- Auth/leads remain owners of contact data, preferences, consent, and unsubscribe truth.
- No UI feature implementation, deployment, real campaign execution, notification provider behavior, scheduler behavior, auth/leads ownership, CRM ownership, or analytics truth ownership was changed in this review.

Gate finding:

- Goal 15 is complete in the current orchestrator sources of truth: `docs/orchestrator/GOALS.md` marks Goal 15 `done` with chunks 15.1-15.5 checked, `STATE.json` records `goal_15_status` as `complete`, and existing `STATUS.md` evidence records Auth-backed session validation, server-side viewer/operator/admin/owner RBAC, protected `/admin` and `/admin/api/session`, service-token rejection for browser identity, protected placeholder namespaces, and passing build/test evidence.
- The remaining Goal 15-related fact is operational rollout evidence, not the implementation gate: [MISSING: production Auth role grant evidence for marketing_viewer, marketing_operator, marketing_admin, and marketing_owner]. This must remain visible before broad production admin rollout.
- Goal 16, Goal 17, and Goal 18 protected UI work should remain gated only by the current integration review/commit and their own ownership blockers, not by ambiguous Goal 15 status.

Docs updated:

- `TASKS.md` now states that TG-3.9, TG-3.10, and TG-3.11 have the Goal 15 admin gate satisfied but remain queued until the current integration commit.
- `STATE.json` now states that Goal 15 is the explicit prerequisite for Goal 16/17/18 protected UI work and that the current remote worktree review/commit is the remaining coordinator gate.
- `docs/orchestrator/PLAN.md` now states that Goal 15 is the explicit gate for Goal 16/17/18 UI workers, and that workers must remain blocked if Goal 15 is not `done` in `GOALS.md` and complete in `STATE.json`/`STATUS.md`.
- `docs/orchestrator/STATUS.md` received this append-only status entry.

Parallel execution and merge/start order:

- Final integration owner should review/commit the current remote worktree first.
- After that commit, Goal 16 campaign/segment admin UI and Goal 17 runs/consent/channel/audit UI may start in parallel with disjoint files and coordinated shared admin navigation/route ordering.
- Goal 18.3-18.5 may start after the same integration commit, but protected dashboard UI must coordinate with Goal 16/17 shared navigation and attribution beyond Marketing-owned campaign facts remains gated by [MISSING: approved analytics/conversion owner contract].
- Goal 19.4/19.5 can start after the integration commit if isolated from admin UI files.
- Goal 20 runtime enforcement remains blocked by missing owner-approved production policy facts and production Auth role grant evidence.

Validation:

- Documentation-only update; no application build/test was run.
- Remote file checks should confirm Goal 15 is explicit in `TASKS.md`, `STATE.json`, `docs/orchestrator/PLAN.md`, and this `STATUS.md` entry.

## 2026-06-14 - Coordinator Next-Goal Processing

Current focus: next-goal orchestration after Goal 15 integration checkpoint.

Preserved intent and ownership boundary:

- Marketing remains the Statex campaign and segmentation control plane.
- Notifications remains the sole outbound provider execution owner.
- Auth and leads remain identity, contact, preference, and consent owners.
- CRM/account and analytics sources remain external truth owners; Marketing stores references, campaign facts, and decision evidence only.
- No real campaign execution was triggered.

Evidence gathered:

- Mandatory orchestrator files and required contract docs were reviewed before assignment.
- Remaining plan state: Goal 16 pending; Goal 17 pending; Goal 18 active with 18.3, 18.4, and 18.5 open; Goal 19 active with 19.4 and 19.5 open; Goal 20 blocked by missing owner-approved production policy facts.
- The previous integration worktree was dirty and gated all next UI/analytics/CRM work.
- Remote `npm run build` passed on 2026-06-14.
- Remote `npm test` passed on 2026-06-14: 64 tests, 64 passing.
- Secret scan found only environment variable references and test redaction fixtures, not committed private key material or literal production secret values.
- Integration checkpoint committed on remote `main`: `b233e2f Integrate marketing admin and roadmap goals`.

Parallel execution launched:

- Goal 16 worker thread `019ec7b4-5f19-79e1-b471-5e26564726ec`; remote worktree `/home/ssf/Documents/Github/marketing-worktrees/goal-16-admin-console`; branch `codex/marketing-goal-16`.
- Goal 17 worker thread `019ec7b4-927c-7c42-8691-e96116defc67`; remote worktree `/home/ssf/Documents/Github/marketing-worktrees/goal-17-ops-views`; branch `codex/marketing-goal-17`.
- Goal 18 worker thread `019ec7b4-ccff-7bf0-a858-95f5315ccb98`; remote worktree `/home/ssf/Documents/Github/marketing-worktrees/goal-18-analytics`; branch `codex/marketing-goal-18`.
- Goal 19 worker thread `019ec7b4-feb1-7f50-b0f4-00ae717cbc79`; remote worktree `/home/ssf/Documents/Github/marketing-worktrees/goal-19-crm`; branch `codex/marketing-goal-19`.

Parallel execution assessment:

- Goal 16 owns campaign/segment admin UI and must avoid runs/audit/channel/analytics/CRM files.
- Goal 17 owns runs, consent, channel registry read view, audit evidence, and correlation search, and must avoid campaign/segment create/edit and analytics files.
- Goal 18 owns analytics attribution metadata/read models/dashboard/export summaries only within Marketing-owned and externally supplied facts; broader attribution truth remains blocked by `[MISSING: approved analytics/conversion owner contract]`.
- Goal 19 owns read-only CRM/account segmentation rules, B2B blueprints, and safe-failure/audit evidence; production CRM use remains disabled until source service configuration exists.
- Goal 20 remains blocked by `[MISSING: production recipient-count thresholds]`, `[MISSING: high-risk approver identities]`, `[MISSING: quiet-hour policy defaults]`, and `[MISSING: owner-approved rollback/deployment policy]`.

Next unfinished step:

- Monitor the four worker branches, then integrate in this order: Goal 19 if isolated, Goal 18 if no shared admin navigation edits, Goal 16, Goal 17, then final coordinator navigation/status validation.
## 2026-06-14 - Goal 16 Campaign And Segment Admin Console

Current focus: Goal 16 - Campaign And Segment Admin Console, chunks 16.1-16.5.

Remote worktree:

- Path: `/home/ssf/Documents/Github/marketing-worktrees/goal-16-admin-console`
- Branch: `codex/marketing-goal-16`
- Base checkpoint: `b233e2f Integrate marketing admin and roadmap goals`

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign definitions, segment definitions, dry-run preview, approval evidence, schedule state, pause/archive state, and audit evidence.
- Browser admin workflows use Auth session RBAC and server-side Marketing admin adapters; the browser never receives `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`.
- Notifications remains the only delivery owner; this work did not add direct sending behavior or real campaign execution controls.
- Auth and leads remain the source of truth for identity, contact data, preferences, consent, and unsubscribe state.
- Backend dry-run, approval, idempotency, consent, unsubscribe, frequency-cap, throttling, max-send, max-30 chunking, registry validation, and notification-delegation contracts remain authoritative.

Implementation evidence:

- Expanded `/admin/campaigns` from a read-only table into protected list/detail/create/edit workflows for campaign definitions.
- Added campaign form validation surface for contract fields: tenant/scope, segment, template, purpose, primary/fallback channels, channel key, frequency cap, throttle, schedule time, status, subject, and body.
- Added read-only approval evidence display; direct approval metadata edits remain rejected by backend validation and approval still uses the explicit admin approval endpoint.
- Added dry-run preview action through `/admin/api/campaigns/:id/dry-run`; preview returns sanitized aggregate run evidence and does not call notifications.
- Added approval workflow action through `/admin/api/campaigns/:id/approve` with admin actor evidence from the Auth-verified session.
- Added schedule, pause, and archive controls through `/admin/api/campaigns/:id/status`; scheduling requires a schedule timestamp and does not expose real execution or scheduler endpoints to the browser.
- Expanded `/admin/segments` into protected list/detail/create/edit workflows for segment definitions, including source type, dynamic/static mode, estimated count, and rules JSON editing.
- Added admin API adapters for campaign and segment detail/create/edit/status operations using existing backend validators, registry validation, and Marketing store contracts.
- Added focused tests covering anonymous rejection, viewer/admin RBAC boundaries, admin create/edit/detail flows, direct approval-field rejection, dry-run redaction, schedule/pause/archive controls, and token non-exposure in rendered admin pages and JSON responses.

Validation:

- `npm install` in the remote worktree installed missing TypeScript/tsx tooling needed for validation; no dependency files were changed. npm reported 3 existing audit findings (1 moderate, 2 high), left unchanged as out of Goal 16 scope.
- `npm run build` passed.
- `npm test` passed: 64 tests, 64 passing.
- Render validation limitation: no screenshot-capable browser/Playwright harness is attached to the remote worktree in this worker session, so desktop/mobile screenshots were not captured. Protected HTML render checks for `/admin/campaigns` and `/admin/segments`, anonymous rejection, and token non-exposure are covered by the remote test suite.

Intent Compliance Report:

- Marketing did not send messages directly and did not add browser-accessible real execution controls.
- Dry-run remains delivery-free and sanitized.
- Real execution remains backend approval-gated and idempotency-gated; scheduler endpoints remain hidden from the browser console.
- Campaign approval evidence is written only through explicit approval workflow, not direct create/edit fields.
- Segment and campaign scope validation still uses the registry contract before mutation.
- No auth/leads source-truth models, notification provider code, analytics views, runs/audit/channel views, or shared admin navigation labels were changed.

Completed chunks:

- 16.1 Build campaigns list/detail/create/edit views.
- 16.2 Build segment list/detail/create/edit views.
- 16.3 Add dry-run preview UI.
- 16.4 Add approval workflow UI.
- 16.5 Add campaign scheduling and pause/archive controls.

Parallel execution notes:

- Goal 16 write ownership stayed disjoint from Goal 17 runs/consent/channels/audit views and Goal 18 analytics dashboards.
- Shared admin navigation labels were not edited; coordinator integration can decide final navigation ordering with Goal 17/18 after merge.

Next unfinished step:

- Coordinator review/integration of branch `codex/marketing-goal-16`, then continue with disjoint Goal 17 or Goal 18/19 workstreams per `docs/orchestrator/PLAN.md`.

## 2026-06-14 - Goal 17 Runs Consent Channels And Audit Admin Views

Current focus: Goal 17 - Runs, Consent, Channels, And Audit Admin Views, chunks 17.1-17.5, implemented in remote worktree `/home/ssf/Documents/Github/marketing-worktrees/goal-17-ops-views` on branch `codex/marketing-goal-17` from checkpoint `b233e2f`.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane and exposes explainability for Marketing-owned execution runs, delivery outcomes, decisions, and audit evidence.
- Auth remains the owner of registered-user identity, contact data, preferences, consent, and unsubscribe truth.
- Leads remains the owner of lead identity, contact data, preferences, consent, and unsubscribe truth.
- Notifications remains the owner of outbound provider execution, provider credentials, final sends, and channel registry behavior.
- This work did not execute real campaigns, add direct delivery, edit campaign/segment create/edit views, edit notification provider implementation, or create auth/leads source-of-truth models.

Implementation evidence:

- Added `src/admin-ops-views.ts` for protected `/admin/runs` and `/admin/audit` HTML views, run/outcome search helpers, correlation filtering, redacted run detail, and redacted audit evidence generation.
- Added `src/notification-channel-registry.ts` for read-only notifications-owned channel registry metadata retrieval through `NOTIFICATION_SERVICE_URL` and optional `NOTIFICATION_CHANNEL_REGISTRY_PATH`, with recursive redaction before returning metadata to the admin UI.
- Updated `src/main.ts` to route `/admin/runs` and `/admin/audit` to Goal 17 views instead of generic placeholders while leaving shared navigation labels in `src/admin-shell.ts` unchanged.
- Added protected admin APIs:
  - `GET /admin/api/runs`
  - `GET /admin/api/runs/:id`
  - `GET /admin/api/outcomes`
  - `GET /admin/api/preferences/:owner/:recipientId`
  - `POST /admin/api/preferences/unsubscribe`
  - `GET /admin/api/channels`
  - `GET /admin/api/audit`
- Run detail, outcome search, audit evidence, and channel registry responses redact recipient addresses, message bodies, provider credentials, authorization tokens, token-like fields, and sensitive contact-address fields.
- Admin preference lookup returns source ownership metadata only and does not copy or expose source-owned consent truth.
- Admin unsubscribe intake validates through the existing public/source-owned unsubscribe contract, requires operator RBAC, forwards when source write configuration exists, and returns pending-source evidence otherwise.
- Channel registry view is read-only and treats Notifications as the registry owner; Marketing does not persist registry truth or provider credentials.

Validation evidence:

- `npm install` was run in the remote worktree because `node_modules` was absent and the initial build failed with `tsc: not found`.
- `npm run build` passed in `/home/ssf/Documents/Github/marketing-worktrees/goal-17-ops-views`.
- `npm test` passed in `/home/ssf/Documents/Github/marketing-worktrees/goal-17-ops-views`: 65 tests passed, 0 failed.
- Added targeted test coverage in `test/api-contracts.test.ts` for Goal 17 RBAC, protected run/outcome APIs, consent ownership lookup, operator-only unsubscribe intake, read-only channel registry metadata, redaction of recipient addresses/message bodies/provider credentials/tokens, audit correlation search, and `/admin/runs`/`/admin/audit` HTML smoke checks.
- Frontend render validation was limited to server-side HTML/API smoke coverage in tests; no browser screenshot capture was performed in this worker session.

Parallel execution and integration notes:

- Write ownership was limited to Goal 17 files, `src/main.ts` route wiring, admin UI tests, and this append-only status entry.
- `src/admin-shell.ts` shared navigation labels were not edited. The existing `Runs` and `Audit` labels now route to implemented Goal 17 views.
- Goal 16 campaign/segment create/edit ownership remains disjoint; this work did not edit `src/admin-campaign-segment-console.ts`.
- Goal 18 analytics dashboard work should coordinate with final shared admin route ordering but does not need to modify these Goal 17 read APIs unless the integration owner explicitly adds dashboard links.

Intent Compliance Report:

- Marketing explains campaign decisions and safety state without owning notifications provider execution or auth/leads contact, consent, preference, or unsubscribe truth.
- Notifications remains the source of truth for channel registry behavior and provider credentials; Marketing only reads sanitized registry metadata.
- Auth/leads remain the source write owners for unsubscribe intake.
- No provider credentials, service tokens, authorization headers, message bodies, notification-provider payload bodies, or recipient addresses are exposed by the new Goal 17 admin APIs or HTML tests.
- No real campaign execution, scheduler operation, direct delivery behavior, or campaign/segment create/edit behavior was added.
## 2026-06-14 - Goal 18 Analytics And Attribution Dashboard Follow-Up

Current focus: Goal 18 - Analytics And Attribution Dashboard, chunks 18.3, 18.4, and 18.5 in dedicated worktree `/home/ssf/Documents/Github/marketing-worktrees/goal-18-analytics` on branch `codex/marketing-goal-18`.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaign definitions, run facts, delivery decisions, campaign attribution references, and sanitized summaries.
- Notifications remains the owner of provider delivery truth. Analytics/app/domain services remain the owners of conversion, revenue/value, customer, funnel, and app behavior truth.
- Auth and leads remain owners of contact data, preferences, consent, and unsubscribe truth.
- This session treats `[MISSING: approved analytics/conversion owner contract]` as a blocker for any broader attribution truth beyond Marketing-owned campaign facts and externally supplied facts.

Implementation evidence:

- Extended `src/analytics.ts` with campaign attribution metadata built from stable campaign, tenant, app, brand, segment, run, correlation, channel, lifecycle, and campaign-family references.
- Added read-only analytics dashboard/read-model helpers that distinguish Marketing-owned sent/skipped/failed counts from externally supplied delivered/converted/attributed-value facts.
- Added CSV export generation from sanitized dashboard rows only; raw recipient addresses, message subjects/bodies, provider credentials, service tokens, authorization headers, and notification-provider payloads are omitted.
- Added protected browser dashboard renderer `src/admin-analytics-dashboard.ts` at `/admin/analytics` without real execution controls, scheduler controls, service-token exposure, or provider data.
- Added protected admin analytics APIs in `src/main.ts`: `GET /admin/api/analytics/summary`, `POST /admin/api/analytics/summary` for externally supplied attribution facts, and `GET /admin/api/analytics/export.csv`.
- Did not edit `src/admin-shell.ts`; the dashboard has its own route and leaves shared admin navigation integration for the coordinator.
- Added analytics/read-model/redaction tests and protected admin dashboard/export tests.

Validation:

- Remote `npm run build` passed in `/home/ssf/Documents/Github/marketing-worktrees/goal-18-analytics`.
- Remote `npm test` passed in `/home/ssf/Documents/Github/marketing-worktrees/goal-18-analytics`: 67 tests, 67 passing.
- Rendered dashboard validation is covered by protected HTML smoke tests for `/admin/analytics`; no browser screenshot capture was performed in this worker session.

Intent Compliance Report:

- Marketing summarizes Marketing-owned campaign/run/outcome facts and attribution references only.
- Delivered, converted, and attributed value figures are unavailable unless supplied as external facts; Marketing does not infer delivery truth, conversion truth, revenue/value truth, customer truth, funnel truth, or app behavior truth.
- The dashboard and export do not expose raw recipient addresses, message bodies, provider credentials, service tokens, source-owned contact/preference truth, notification provider payloads, or direct campaign execution controls.
- No real campaign, scheduler, journey, notification provider, auth/leads source-truth, CRM master-data, or deployment behavior was changed.

Coordinator handoff:

- Shared admin navigation still needs coordinator integration with Goal 16/17 routes if `/admin/analytics` should appear in the common `ADMIN_SHELL_ROUTES` list.
- `[MISSING: approved analytics/conversion owner contract]` remains the blocker for any broader attribution ownership or persisted analytics/customer-insights truth.
## 2026-06-14 - Goal 19.4-19.5 CRM Account Rules, Blueprints, And Audit Evidence

Current focus: Goal 19 - CRM/Account Service Integration, chunks 19.4 and 19.5.

Remote worktree and branch:

- Worktree: `/home/ssf/Documents/Github/marketing-worktrees/goal-19-crm`.
- Branch: `codex/marketing-goal-19`.
- Start checkpoint: `b233e2f Integrate marketing admin and roadmap goals`.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane.
- CRM/account lifecycle, opportunity, owner, health, onboarding, renewal, upsell, and winback state remains source-owned by the future CRM/account service.
- Marketing stores only segment predicates, blueprint suggestions, source references, dry-run/execution decisions, and audit evidence.
- Auth/leads remain the only reachable recipient, contact, preference, consent, and unsubscribe owners.
- Notifications remains the only outbound delivery executor.
- Production CRM/account use remains disabled until `CRM_ACCOUNT_SERVICE_URL` and source-service auth/readiness are configured.

Parallel execution assessment:

- Track D Goal 19 is isolated from Goal 16/17 admin UI and Goal 18 analytics dashboard files.
- Chunks 19.4 and 19.5 were safe to complete serially in this worktree because they touch the same CRM/account blueprint/test/status surface.
- No other worker should edit `src/campaign-blueprints.ts`, CRM/account executor tests, or this Goal 19 status evidence until this branch is integrated.
- Goal 20 enforcement remains blocked by missing owner-approved policy decisions.

Implementation evidence:

- Added four B2B CRM/account lifecycle blueprint suggestions in `src/campaign-blueprints.ts`:
  - `runlayer.crm-onboarding.default`
  - `runlayer.crm-renewal.default`
  - `runlayer.crm-upsell.default`
  - `runlayer.crm-winback.default`
- Each CRM/account blueprint uses `crm_accounts` plus auth/leads recipient resolution sources and contains only read-only segment predicate suggestions.
- Added blueprint tests proving CRM/account blueprints are non-executable metadata, have deterministic catalog filtering, and do not contain approval state or message bodies.
- Added dry-run CRM/account lifecycle rule tests for onboarding, renewal, upsell, and winback using the generated read-only signal contract.
- The dry-run lifecycle tests use a pending/draft campaign and prove no notification call is made; source-owned lead consent is still enforced as `consent_missing`.
- Strengthened CRM/account source failure coverage to assert `recipient_source_failed` audit evidence is emitted for `crm_accounts` before notification delegation and that notification chunk audit events are absent.
- Updated `docs/agents/contracts/marketing-campaign-contract.md` with the Goal 19.4 CRM/account blueprint extension and initial blueprint rows.
- Updated `docs/agents/contracts/crm-account-signal-contract.md` to record the Goal 19.4 blueprint use of read-only predicates.
- Marked Goal 19.4 and 19.5 complete in `docs/orchestrator/GOALS.md` and updated `STATE.json` Goal 19 status.

Validation:

- Remote `npm run build` passed after installing worktree dependencies with `npm install`.
- Remote `npm test` passed: 66 tests, 66 passing.

Intent Compliance Report:

- Marketing did not take ownership of CRM/account master data, companies, opportunities, account owners, lifecycle state, health state, onboarding state, customer-success notes, account-contact relationships, auth/leads contacts, consent, unsubscribe truth, notification provider execution, provider credentials, tenant/app registry truth, or analytics truth.
- CRM/account signals remain read-only segmentation inputs.
- B2B CRM/account blueprints remain suggestions only and do not approve, schedule, dry-run, execute, or delegate delivery by themselves.
- Real campaign delivery remains blocked by explicit campaign approval, auth/leads consent and unsubscribe enforcement, frequency caps, throttling, idempotency, max-send, max-30 chunking, registry validation, and notifications delegation.
- CRM/account source failure produces safe failed evidence before notification delegation.

Completed chunks:

- Goal 19.4 - Add B2B account segment rules and campaign blueprints.
- Goal 19.5 - Add safe failure and audit evidence.

Next unfinished step:

- Integrate `codex/marketing-goal-19` after review; production CRM/account use still requires configured `CRM_ACCOUNT_SERVICE_URL` and source-service auth/readiness.

## 2026-06-15 - Coordinator Integration Reconciliation For Goals 16-19

Current focus: reconcile the already-merged Goal 16, Goal 17, Goal 18, and Goal 19 worker branches on `main`.

Preserved intent and ownership boundary:

- Marketing remains the campaign and segmentation control plane for campaigns, segments, runs, delivery decisions, campaign analytics references, CRM/account segmentation predicates, and audit evidence.
- Notifications remains the only outbound provider execution owner and channel registry owner.
- Auth and leads remain the owners of contact data, preferences, consent, unsubscribe state, and reachable recipient truth.
- CRM/account lifecycle and opportunity truth remains source-owned by the future CRM/account service; Marketing stores only read-only predicates, blueprint suggestions, source references, and decision evidence.
- Analytics/app/domain services remain owners of conversion, revenue/value, customer, funnel, and app behavior truth.
- No real campaign, scheduler operation, direct provider call, production deployment, or production role grant was executed in this reconciliation.

Integration evidence:

- Confirmed `main` already contains merge commits for `codex/marketing-goal-16`, `codex/marketing-goal-17`, `codex/marketing-goal-18`, and `codex/marketing-goal-19`.
- Added `/admin/analytics` to `ADMIN_SHELL_ROUTES` so the shared protected admin navigation includes the integrated analytics dashboard.
- Marked Goal 16 chunks 16.1-16.5 complete in `docs/orchestrator/GOALS.md`.
- Marked Goal 17 chunks 17.1-17.5 complete in `docs/orchestrator/GOALS.md`.
- Marked Goal 18 chunks 18.1-18.5 complete in `docs/orchestrator/GOALS.md` for Marketing-owned campaign analytics and externally supplied attribution facts.
- Marked Goal 19 complete in `docs/orchestrator/GOALS.md`; production CRM/account use remains disabled until source service URL and auth/readiness are configured.
- Updated `TASKS.md` so only TG-3.13 Goal 20 runtime governance enforcement remains in backlog.
- Updated `STATE.json` to `phase-7-goals-16-19-integrated` with Goal 20 as the next blocked focus.

Validation evidence:

- Remote `npm run build` passed in `/home/ssf/Documents/Github/marketing-microservice`.
- Remote `npm test` passed in `/home/ssf/Documents/Github/marketing-microservice`: 70 tests, 70 passing.

Intent Compliance Report:

- The reconciliation does not move notification provider execution, provider credentials, contact ownership, consent ownership, unsubscribe ownership, CRM master data, analytics truth, app/domain truth, or tenant/app registry truth into Marketing.
- Goal 18 remains limited to Marketing-owned campaign/run/outcome facts plus externally supplied attribution facts; broader attribution ownership is still blocked by `[MISSING: approved analytics/conversion owner contract]`.
- Goal 20 runtime enforcement remains blocked by missing owner-approved production recipient thresholds, approver identities, quiet-hour defaults, emergency override rules, and rollback/deployment policy.

Next unfinished step:

- Goal 20.6 runtime governance enforcement can start only after the missing owner-approved production policy facts are supplied.

## 2026-06-21 - TG-3.13 Goal 20 Runtime Governance Enforcement

Current focus: Goal 20 production governance runtime enforcement.

Intent Preservation Chain:

- Vision: Statex applications can run production campaigns through one audited control plane without duplicating delivery, consent, or governance ownership.
- Goal Impact: Goal 20 is no longer blocked by missing owner policy facts; conservative AI-approved defaults now protect real execution.
- System: Marketing remains the campaign and segmentation control plane; notifications owns outbound provider execution; auth/leads own identity, contact, preference, consent, and unsubscribe truth; source services own conversion truth.
- Feature: Production risk classification, approval evidence, quiet-hour guardrails, readiness/rollback references, restricted/emergency override evidence, and source-failure blocking.
- Task: TG-3.13 / Goal 20.6 runtime enforcement.
- Execution Plan: Keep implementation local to Marketing-owned runtime, metadata, tests, and docs; do not fabricate private identities or modify Auth assignments.
- Coding Prompt: Enforce conservative defaults before notification delegation and preserve existing campaign approval, consent, unsubscribe, frequency-cap, max-send, chunking, idempotency, registry, and notification gates.
- Code: src/production-governance.ts, src/executor.ts, src/types.ts, src/api-contracts.ts, .env.example, and focused executor tests.
- Validation: npm run check passed; npm run build passed; npm test passed with 73 tests; git diff --check passed.

Implementation evidence:

- Added conservative defaults for role mapping contract, analytics/conversion ownership, recipient risk thresholds, approver evidence sources, quiet hours, emergency override, and AI-approved deployment/rollback procedure.
- Added runtime governance evaluation before real notification delegation. Production-like campaigns now require current dry-run evidence, readiness and rollback refs, non-automation approval actor, quiet-hour compliance, and stronger high-risk/restricted evidence.
- Scheduler and journey sends reuse executeCampaign, so Goal 20 gates apply to manual, scheduled, and journey-controlled real execution.
- Added catalogMetadata.governance API validation for evidence references without storing private identity assignments.

Parallel execution section:

- Ready now: final validation/commit/deploy integration in this coordinator thread.
- Future independent lane: admin governance evidence UX; allowed files admin UI/API adapters only; blocked by integration commit; validation owner future UI worker.
- Future independent lane: stricter external policy-source integration; allowed files policy adapter/docs/tests; forbidden Auth assignments and provider credentials; validation owner policy integration worker.
- Future independent lane: production monitoring; read-only deployment health and audit evidence checks.
- Integration owner: this thread. Merge order: runtime gate, docs/state, validation, commit, push, deploy if validation passes.

## 2026-06-24 - Hosted Auth Redirect/Callback Verification

Current focus: Marketing hosted Auth redirect/callback verification and stale blocker reconciliation.

Intent Preservation Chain:

- Vision: Alfares applications use Auth-hosted login and registration instead of app-local credential collection.
- Goal Impact: Marketing admin entry remains delegated to Auth while Marketing preserves campaign execution, recipient/contact, notification provider, and service-token ownership boundaries.
- System: Auth owns hosted `/login`, `/register`, and `/auth/validate`; Marketing owns `/auth/login`, `/auth/register`, `/auth/callback`, admin session handoff, and protected Marketing APIs.
- Feature: Hosted Auth redirect/callback verification for Marketing.
- Task: Verify current Marketing auth routes, reconcile stale docs that still say login/register is blocked, and patch only small safe standards gaps.
- Execution Plan: Remote-only static/source validation; no secrets, `.env` values, Kubernetes Secret data, live DB data, deploys, campaign execution, recipient/contact exports, notification provider config, service-token changes, DB/migration files, or deploy/k8s files.
- Coding Prompt: Preserve Auth as browser identity owner and `/auth/validate` authority; keep service-token protected write APIs separate; route login/register through hosted Auth with `return_url`, `client_id`, and `state`; callback must fail closed on missing/mismatched state.
- Code: `public/auth-callback.html`, `test/api-contracts.test.ts`, and `docs/orchestrator/2026-06-24-marketing-hosted-auth-verification-plan.md`.
- Validation: `npm run build` passed; `npm test` passed with 73 tests; `npx tsx --test --test-concurrency=1 test/api-contracts.test.ts` passed with 24 tests; hosted Auth static route scan passed; `git diff --check` passed after formatting cleanup.

Current auth surface:

- `src/main.ts` implements `GET /auth/login` and `GET /auth/register` redirects to hosted Auth with `return_url=https://marketing.alfares.cz/auth/callback`, `client_id=marketing-microservice`, and generated `state`.
- `src/main.ts` serves `GET /auth/callback` from `public/auth-callback.html` with the configured admin access-token cookie name.
- `public/auth-callback.html` parses URL fragment tokens, now requires an existing `marketing_auth_state` cookie and matching returned `state`, stores only the Auth access token on the admin cookie path, clears the temporary state cookie, and redirects to `/admin`.
- `src/admin-auth.ts` continues server-side browser admin validation through Auth `POST /auth/validate` and role mapping.
- Service-token protected write APIs were not changed.

Stale-doc reconciliation:

- Historical 2026-06-13 `STATUS.md` entries that say Goal 14.3/14.4 were blocked by missing auth URL, return URL, or admin route contracts are superseded by later Goal 14/15 completion evidence and this verification.
- `docs/orchestrator/GOALS.md` currently marks Goal 14 chunks 14.1-14.5 complete, including register/login/admin buttons and Auth return URLs.
- Current source and tests confirm hosted Auth login/register redirect and callback behavior; do not treat older blocked lines as current state without new regression evidence.

Blockers and unknowns:

- `[UNKNOWN: current deployed version versus source]`; no deploy or live runtime parity check was permitted.
- `[MISSING: live admin callback/session smoke with safe token]`; no secrets, token values, or live DB/runtime data were read.
- `[MISSING: production Auth role grant evidence]`; Auth role assignments were outside this verification scope.

## 2026-07-01 - Orders Production Rollout Goal 7.4 Marketing Orders Events Integration

Current focus: Goal 7.4 Marketing Orders-events integration for the Orders production rollout.

Intent Preservation Chain:

- Vision: Statex applications can use canonical Orders lifecycle facts while Marketing remains the campaign and segmentation control plane.
- Goal Impact: Marketing now has a narrow, transport-independent Orders lifecycle event consumer core and contract tests, while runtime broker consumption remains explicitly blocked until queue/config contracts are approved.
- System: Orders owns order records, order items, order status lifecycle, and lifecycle event publication. Marketing owns campaign definitions, segment definitions, execution runs, delivery decisions, campaign attribution evidence, and aggregate Marketing-owned statistics. Notifications remains outbound provider owner. Auth/leads remain contact, preference, consent, and unsubscribe owners.
- Feature: Read-only consumption contract for `orders.events` lifecycle signals.
- Task: Verify Orders producer source, add a bounded Marketing-side event handler/contract surface, prove idempotency/stat aggregation behavior, and document runtime blockers.
- Execution Plan: Marketing repo only; do not edit Orders or add a large broker transport layer without existing Marketing infrastructure; keep order events from triggering campaign execution.
- Coding Prompt: Validate event envelopes, reject sensitive/non-contract payload fields, deduplicate by event ID, aggregate order signal statistics, preserve Orders as source of truth, and mark missing broker/status-key/attribution facts as `[MISSING: ...]`.
- Code: `src/order-lifecycle-events.ts`, `test/order-lifecycle-events.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`, and `docs/agents/contracts/integration-api-matrix.md`.
- Validation: focused Orders event tests passed; `npm run build` passed; `npm test` passed with 77 tests; `git diff --check` passed.

Preflight and source verification:

- Remote Marketing repository path: `/home/ssf/Documents/Github/marketing-microservice`.
- Starting Marketing status: `## main...origin/main` at `d46acbe Merge remote-tracking branch 'origin/main'`, clean before this lane.
- Orders source repository: `/home/ssf/Documents/Github/orders-microservice` at `d1c5a48 feat: plan production order integration`.
- Verified Orders producer exchange: `orders.events`.
- Verified Orders created routing key: `orders.order.created.v1`.
- Verified Orders status-change routing key: `orders.order.updated.v1`.
- Requested `orders.order.status_changed.v1` was not found in Orders docs/source: `[MISSING: Orders producer routing key orders.order.status_changed.v1; current source publishes orders.order.updated.v1 for status changes]`.
- Marketing runtime config key scan printed names only: `.env.example` has `ORDERS_SERVICE_URL`, `ORDERS_SERVICE_TOKEN`, `ORDER_SIGNAL_PATH`, and `ORDER_SIGNAL_LIMIT`; `.env` has `ORDERS_SERVICE_URL`; `k8s/configmap.yaml` has no Orders/broker event keys.
- No Marketing RabbitMQ/AMQP/Kafka/NATS consumer infrastructure or dependency was found in the current source/package surface.

Implementation evidence:

- Added `src/order-lifecycle-events.ts` with bounded validation for `orders.order.created.v1` and current Orders status-change events through `orders.order.updated.v1`.
- Added explicit rejection for requested but unproduced `orders.order.status_changed.v1`, returning the documented `[MISSING: ...]` blocker.
- Added idempotency guard by `eventId`.
- Added aggregate order signal statistics by event type, channel, and status.
- Added forbidden sensitive-field rejection for customer/contact/address/payment/tracking/token-like payload keys.
- Added campaign attribution status as blocked instead of inventing attribution from current Orders payloads, because the verified event contract has no campaign/run/correlation references.
- Added `docs/agents/contracts/orders-events-integration-contract.md` documenting producer evidence, Marketing consumer core behavior, runtime blockers, proposed queue adapter contract, and ownership boundaries.
- Updated `docs/agents/contracts/integration-api-matrix.md` so Orders events are documented as read-only lifecycle signal inputs and not campaign execution triggers.
- Did not add a RabbitMQ listener, deployment switch, env secret, DB migration, queue declaration, or deploy step in this chunk.

Validation evidence:

- `npx tsx --test --test-concurrency=1 test/order-lifecycle-events.test.ts` passed: 4 tests, 4 passing.
- `npm run build` passed.
- `npm test` passed: 77 tests, 77 passing.
- `git diff --check` passed.

Runtime blockers:

- `[MISSING: Marketing RabbitMQ consumer transport and queue binding configuration for orders.events]`.
- `[MISSING: approved Marketing queue name, dead-letter behavior, replay/backfill policy, and consumer deployment switch]`.
- `[MISSING: Orders producer routing key orders.order.status_changed.v1; current source publishes orders.order.updated.v1 for status changes]`.
- `[MISSING: Orders event payload campaignId/runId/correlationId or approved attribution join contract for campaign-level attribution]`.

Intent Compliance Report:

- Marketing did not edit Orders, Leads, Notifications, marketplace services, Warehouse, or Catalog.
- Marketing did not become the source of truth for order records, order items, order status, customer data, payment data, address data, tracking data, or source-owned event publication.
- Orders lifecycle events do not approve, schedule, dry-run, execute, or deliver campaigns.
- Notifications remains the only outbound provider execution owner.
- Auth/leads remain contact, preference, consent, and unsubscribe owners.
- No real campaign execution, irreversible DB operation, deployment, or secret value exposure occurred.

Parallel execution section:

- Ready now: runtime consumer adapter design can start after owner approves broker env names, queue name, replay/backfill, and status routing-key decision.
- Dependency-gated: persisted order attribution/stat read model is blocked by approved storage contract and campaign attribution join keys.
- Blocked: consuming `orders.order.status_changed.v1` is blocked until Orders publishes that routing key or the rollout accepts `orders.order.updated.v1` as the canonical status-change event.
- Final integration: deploy only after runtime config is confirmed and full validation passes.

Next unfinished step:

- Decide whether Marketing should bind to current `orders.order.updated.v1` or wait for Orders to publish `orders.order.status_changed.v1`, then approve the Marketing queue/runtime config contract before implementing a live RabbitMQ consumer.

## 2026-07-01 - Orders Events Status-Change Binding Decision

Current focus: Apply owner decision for Goal 7.4 Marketing Orders-events status-change routing.

Intent Preservation Chain:

- Vision: Marketing consumes canonical Orders lifecycle facts without becoming the Orders source of truth.
- Goal Impact: The status-change routing-key decision is resolved for Marketing: bind to current `orders.order.updated.v1`.
- System: Orders remains order lifecycle event owner; Marketing remains campaign and segmentation control plane.
- Feature: Orders lifecycle event consumer contract.
- Task: Update Marketing consumer contract/tests/docs to treat `orders.order.updated.v1` as the approved status-change binding.
- Execution Plan: Small Marketing-only follow-up; no runtime listener, deployment, env secret, DB migration, or Orders edit.
- Coding Prompt: Remove `orders.order.status_changed.v1` from active runtime blockers while still rejecting it as an unapproved alias unless Orders adds that producer contract later.
- Code: `src/order-lifecycle-events.ts`, `test/order-lifecycle-events.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`, and this status entry.
- Validation: focused Orders event tests passed; `npm run build` passed; `npm test` passed with 77 tests; `git diff --check` passed.

Decision applied:

- Marketing should bind status changes to the current Orders producer key: `orders.order.updated.v1`.
- `orders.order.status_changed.v1` is no longer a blocker for this Marketing lane; it remains an unsupported alias unless Orders publishes it in a future contract.
- Remaining runtime blockers are broker/queue/replay config and missing campaign/run/correlation attribution references in Orders events.

Next unfinished step:

- Approve Marketing RabbitMQ queue/runtime config, dead-letter behavior, replay/backfill policy, and persistence contract before implementing a live consumer adapter.

## 2026-07-01 - Orders Events Live Consumer Adapter

Current focus: Implement the approved live Marketing consumer adapter for Orders lifecycle events.

Intent Preservation Chain:

- Vision: Marketing can consume canonical Orders lifecycle facts without owning order truth or creating campaign execution side effects.
- Goal Impact: The runtime lane now has a gated AMQP adapter, durable idempotency storage, queue/dead-letter defaults, and replay-safe processing for `orders.order.created.v1` plus `orders.order.updated.v1`.
- System: Orders owns order records, status lifecycle, and lifecycle event publication. Marketing owns only bounded campaign attribution/stat signal evidence. Notifications owns outbound delivery. Auth/leads own contacts, consent, preferences, and unsubscribe truth.
- Feature: Gated RabbitMQ consumer for `orders.events`.
- Task: Add AMQP consumer, durable event dedupe, runtime env keys, config defaults, tests, and docs.
- Execution Plan: Marketing repo only; do not edit Orders; do not deploy; do not log broker URL or payload secrets; default Kubernetes config keeps the consumer disabled until runtime secret/config is confirmed.
- Coding Prompt: Bind `orders.order.created.v1` and approved `orders.order.updated.v1`, persist bounded lifecycle facts by `eventId`, reject malformed/sensitive events without campaign execution, dead-letter processing errors by default, and preserve source ownership.
- Code: `src/orders-events-consumer.ts`, `src/order-lifecycle-events.ts`, `src/store.ts`, `migrations/0011_order_lifecycle_event_consumer.sql`, `.env.example`, `k8s/configmap.yaml`, `test/order-lifecycle-events.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`, package dependency updates, and this status entry.
- Validation: focused Orders event tests passed with 6 tests; `npm run build` passed; `npm test` passed with 79 tests; `git diff --check` passed.

Runtime contract applied:

- Queue: `marketing.orders.lifecycle`.
- Exchange: `orders.events`.
- Bindings: `orders.order.created.v1`, `orders.order.updated.v1`.
- Dead-letter exchange: `marketing.orders.lifecycle.dlx`.
- Prefetch: `10`.
- Requeue on processing/storage error: `false` by default.
- Deployment switch: `ORDERS_EVENTS_CONSUMER_ENABLED`; initially disabled until runtime secret confirmation, then enabled in `k8s/configmap.yaml` after owner approval.
- Broker URL: `RABBITMQ_URL`, documented in `.env.example`; value is not logged and is not placed in ConfigMap.
- Runtime name check after implementation: current Kubernetes deployment environment did not list `RABBITMQ_URL` or `ORDERS_EVENTS_*` names before the Vault/config manifest update.

Persistence and replay:

- Migration `0011_order_lifecycle_event_consumer.sql` creates `marketing_order_lifecycle_events`.
- `event_id` is the primary key and dedupes live delivery plus replay/backfill.
- Persisted fields are bounded to event ID, event type/version, order ID, timestamps, channel, status, and previous status.
- No customer/contact/address/payment/tracking/provider/token payload data is stored.

Remaining blocker:

- `[MISSING: Orders event payload campaignId/runId/correlationId or approved attribution join contract for campaign-level attribution]`.

Next unfinished step:

- Confirm runtime `RABBITMQ_URL` secret/config exists and then decide whether to deploy with `ORDERS_EVENTS_CONSUMER_ENABLED=true`.

## 2026-07-01 - Orders Events Vault Runtime Enablement

Current focus: Wire Kubernetes/Vault runtime configuration and proceed toward deployment for Goal 7.4.

Intent Preservation Chain:

- Vision: Marketing consumes canonical Orders lifecycle facts while Orders remains the order lifecycle source of truth.
- Goal Impact: The live consumer now has explicit runtime configuration names and a Vault-backed broker URL mapping without exposing secret values.
- System: Marketing reads Orders lifecycle events only as bounded campaign attribution/stat signals; it does not own Orders records, payment, contact, delivery, or approval authority.
- Feature: Orders events AMQP runtime enablement.
- Task: Add `RABBITMQ_URL` to the Marketing ExternalSecret, enable `ORDERS_EVENTS_CONSUMER_ENABLED`, and validate before deploy.
- Execution Plan: Reuse the existing Kubernetes Vault mapping source by name, keep non-secret event settings in ConfigMap, run focused/full validation, then deploy only after checks pass.
- Coding Prompt: Map the broker URL secret by name only, bind to `orders.order.created.v1` and `orders.order.updated.v1`, avoid logging secret values, and preserve dead-letter/idempotency behavior.
- Code: `k8s/external-secret.yaml`, `k8s/configmap.yaml`, `docs/agents/contracts/orders-events-integration-contract.md`, and this status entry.
- Validation: focused Orders event tests passed with 6 tests; `npm run build` passed; `npm test` passed with 79 tests; `git diff --check` passed after whitespace repair.

Runtime evidence:

- Existing namespace ExternalSecret evidence showed `RABBITMQ_URL` mapped from Vault path `secret/prod/runlayer` property `RABBITMQ_URL` through `runlayer-secret`; value was not printed.
- Existing `marketing-microservice-secret` exposed only key names `DB_PASSWORD`, `JWT_TOKEN`, `MARKETING_API_TOKEN`, and `NOTIFICATION_SERVICE_TOKEN` before this change; no values were printed.
- `k8s/external-secret.yaml` now maps Marketing secret key `RABBITMQ_URL` from `secret/prod/runlayer` property `RABBITMQ_URL`.
- `k8s/configmap.yaml` now sets `ORDERS_EVENTS_CONSUMER_ENABLED="true"` and carries non-secret queue/exchange/dead-letter defaults.

Remaining blocker:

- `[MISSING: Orders event payload campaignId/runId/correlationId or approved attribution join contract for campaign-level attribution]`.

## 2026-07-01 - Orders Events Consumer Production Deploy

Current focus: Deploy and verify Goal 7.4 Marketing Orders-events runtime integration.

Intent Preservation Chain:

- Vision: Marketing consumes canonical Orders lifecycle facts while Orders remains the source of truth.
- Goal Impact: The live Orders event consumer is deployed with Vault-backed broker configuration and current Orders routing keys.
- System: Marketing consumes read-only order lifecycle signals only; it does not own order truth, customer/contact data, payment data, delivery execution, or campaign approval authority from Orders events.
- Feature: Production AMQP consumer for `orders.events`.
- Task: Deploy commit `5178b9c`, verify Kubernetes config/secret names, health, rollout, and consumer startup logs.
- Execution Plan: Deploy after validation; inspect names only for secret/env evidence; avoid printing secret values; keep remaining attribution blocker explicit.
- Coding Prompt: Confirm the consumer starts on `orders.order.created.v1` and `orders.order.updated.v1` with durable queue/dead-letter defaults and no direct campaign execution side effects.
- Code: deployed image `localhost:5000/marketing-microservice:5178b9c`.
- Validation: rollout succeeded; pod `1/1 Running`; ExternalSecret `SecretSynced=True`; health returned `status=ok`; runtime env names include `RABBITMQ_URL` and `ORDERS_EVENTS_*`; logs show `orders_events_consumer_started` for `orders.order.created.v1` and `orders.order.updated.v1`.

Deployment evidence:

- `./scripts/deploy.sh` completed successfully in 162.59s.
- Kubernetes deployment `marketing-microservice` rolled out successfully.
- Runtime secret key names include `RABBITMQ_URL`; secret value was not printed.
- Runtime env names include `ORDERS_EVENTS_CONSUMER_ENABLED`, exchange, queue, routing keys, dead-letter, prefetch, requeue, and `RABBITMQ_URL`; values were not printed.
- Consumer startup log shows exchange `orders.events`, queue `marketing.orders.lifecycle`, routing keys `orders.order.created.v1` and `orders.order.updated.v1`, dead-letter exchange `marketing.orders.lifecycle.dlx`, and prefetch `10`.

Known residual evidence:

- `npm install`/Docker `npm ci` reported existing dependency audit issues: 3 local audit findings before deploy and 2 production-image findings during deploy. They were not remediated in this lane because they are outside the narrow Orders-events integration.
- One post-deploy audit-forward log returned status 404; service health and consumer startup were OK. This appears unrelated to Orders event consumption and was not changed in this lane.

Remaining blocker:

- `[MISSING: Orders event payload campaignId/runId/correlationId or approved attribution join contract for campaign-level attribution]`.

## 2026-07-01 - Orders Events Campaign Attribution Join Contract

Current focus: Define and execute the Orders-to-Marketing campaign attribution join contract for Goal 7.4.

Intent Preservation Chain:

- Vision: Marketing consumes canonical Orders lifecycle facts while Orders remains the source of truth for order lifecycle and event publication.
- Goal Impact: Campaign-level attribution is no longer blocked when Orders created events carry the current explicit join key `payload.leadAttribution.campaignId`.
- System: Orders owns order records and events; Marketing owns campaign definitions and Marketing-owned aggregate attribution evidence; Leads/Auth remain identity/contact/consent owners; Notifications remains delivery owner.
- Feature: Orders event campaign attribution join.
- Task: Use the verified Orders optional `leadAttribution.campaignId` field as the only current campaign-level join key, persist it as bounded Marketing attribution evidence, and keep run/correlation attribution blocked until explicit fields exist.
- Execution Plan: Marketing repo only; read Orders source/docs; do not edit Orders; add nullable `campaign_id`, parser validation, stats aggregation, tests, docs, and status evidence; deploy after validation.
- Coding Prompt: Accept `orders.order.created.v1` with optional `payload.leadAttribution.campaignId`, ignore `leadId/source` for Marketing persistence, join later status events by `orderId`, preserve idempotency and no campaign execution side effects.
- Code: `src/order-lifecycle-events.ts`, `src/store.ts`, `migrations/0012_order_lifecycle_campaign_attribution.sql`, `test/order-lifecycle-events.test.ts`, `docs/agents/contracts/orders-events-integration-contract.md`, `docs/agents/contracts/integration-api-matrix.md`, and this status entry.
- Validation: focused Orders event tests passed with 7 tests; `npm run build` passed; `npm test` passed with 80 tests; `git diff --check` passed.

Verified producer evidence:

- Orders repo already documents and verifies optional `payload.leadAttribution.campaignId` on `orders.order.created.v1`.
- Marketing did not edit Orders or infer attribution from customer/contact/address/payment data.

Attribution contract applied:

- Accepted campaign join key: `payload.leadAttribution.campaignId` on `orders.order.created.v1`.
- Persisted Marketing field: nullable `marketing_order_lifecycle_events.campaign_id`.
- Marketing ignores `leadAttribution.leadId` and `leadAttribution.source` for this table; those remain source-owned and are not copied as Marketing identity truth.
- Later `orders.order.updated.v1` events are campaign-attributed only through previously persisted `orderId -> campaignId` evidence.
- Campaign attribution stats now expose `byCampaignId`, `campaignRefs`, `campaignAttributionUpdates`, and `unattributedOrderSignals`.
- No Orders event approves, schedules, dry-runs, executes, or delivers a campaign.

Remaining blocker:

- `[MISSING: Orders event payload runId/correlationId or approved attribution join contract for run-level attribution]`.

## 2026-07-01 - Orders Events Campaign Attribution Deploy Evidence

Current focus: Deploy and verify the campaign attribution join implementation.

Intent Preservation Chain:

- Vision: Marketing consumes canonical Orders lifecycle facts while preserving Orders as source of truth.
- Goal Impact: Campaign-level attribution join is now live for Orders created events that include explicit `payload.leadAttribution.campaignId`.
- System: Marketing persists bounded campaign attribution evidence only; it does not store lead identity from Orders attribution metadata and does not execute campaigns from order events.
- Feature: Production deployment of Orders campaign attribution join.
- Task: Deploy commit `8fd8d64`, ensure migration `0012` applies, verify health and consumer startup.
- Execution Plan: Run deploy, detect whether Kubernetes restarted, pin deployment to immutable image if needed, verify schema by column names only, and inspect sanitized startup logs.
- Coding Prompt: Confirm `campaign_id` exists and the live Orders consumer remains bound to `orders.order.created.v1` and `orders.order.updated.v1`.
- Code: deployed image `localhost:5000/marketing-microservice:8fd8d64`.
- Validation: rollout succeeded; health returned `status=ok`; schema check returned `campaign_id` and `event_id`; selected running pod logs show `orders_events_consumer_started` at `2026-07-01T15:24:33.847Z`.

Deployment evidence:

- `./scripts/deploy.sh` built and pushed image `localhost:5000/marketing-microservice:8fd8d64` and completed successfully in 2.75s.
- The deploy script initially left the Deployment image as `latest`, so Kubernetes did not restart the pod and the first schema check only returned `event_id`.
- `kubectl -n statex-apps set image deployment/marketing-microservice app=localhost:5000/marketing-microservice:8fd8d64` forced an immutable image rollout.
- New pod `marketing-microservice-d9888bbbc-9vfjn` reached `1/1 Running` with zero restarts.
- Read-only schema check from the pod returned column names `campaign_id` and `event_id`; no DB secret values or rows were printed.
- Health returned `{"status":"ok","service":"marketing-microservice"}`.
- Consumer startup log shows exchange `orders.events`, queue `marketing.orders.lifecycle`, routing keys `orders.order.created.v1` and `orders.order.updated.v1`, dead-letter exchange `marketing.orders.lifecycle.dlx`, and prefetch `10`.

Known residual evidence:

- Post-start audit log forwarding still reports status 404. This predates the attribution join and does not block Orders event consumption; it remains unrelated follow-up debt.

Remaining blocker:

- `[MISSING: Orders event payload runId/correlationId or approved attribution join contract for run-level attribution]`.


## 2026-07-02 - Order Affinity Catalog Publisher Source

Current focus: Connect Marketing's bounded Orders co-purchase candidates to Catalog's protected relation batch endpoint without enabling live writes by default.

Intent Preservation Chain:

- Vision: Real customer purchase behavior can inform related products and future bundles across marketplaces while Catalog remains product relation truth.
- Goal Impact: Marketing now has a source-implemented, replay-safe publisher for order-affinity candidates; deployment can carry the code safely with writes disabled until the Catalog internal token and mutation window are approved.
- System: Orders owns order events, Marketing derives bounded co-purchase signals, Catalog owns product relation persistence and validation, marketplaces read Catalog relations.
- Feature: Guarded Marketing-to-Catalog order affinity publisher.
- Task: Add publisher env contract, service-auth POST payload, consumer integration, disabled-by-default Kubernetes config, and unit coverage for disabled/missing-config/published paths.
- Execution Plan: Marketing repo only; do not mutate Catalog data; do not print secret values; keep `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=false` in runtime config; require `CATALOG_INTERNAL_SERVICE_TOKEN` before enabling live writes.
- Coding Prompt: Build directed order-affinity candidates from accepted `orders.order.created.v1` signals, POST bounded batches to `/api/internal/product-relations/order-affinity/batch` with `x-internal-service-token`, and skip safely when disabled or missing config.
- Code: `src/order-affinity-catalog-publisher.ts`, `src/orders-events-consumer.ts`, `test/order-lifecycle-events.test.ts`, `.env.example`, `k8s/configmap.yaml`, `docs/agents/contracts/orders-events-integration-contract.md`, and this status entry.
- Validation: `npm test` passed with 87 tests; `npm run build` passed; `git diff --check` passed.

Runtime contract:

- Default publish switch: `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=false`.
- Catalog URL key: `CATALOG_SERVICE_URL`.
- Secret token key: `CATALOG_INTERNAL_SERVICE_TOKEN`; value must come from secret management and must not be logged.
- Batch endpoint key: `CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT`, default `/api/internal/product-relations/order-affinity/batch`.
- Timeout and batch sizing keys: `CATALOG_ORDER_AFFINITY_TIMEOUT_MS`, `CATALOG_ORDER_AFFINITY_BATCH_SIZE`.
- Idempotency key: `marketing_order_affinity:<ordersEventId>:<batchIndex>`.

Remaining blockers:

- `[MISSING: runtime Catalog internal service token secret mapping for Marketing-to-Catalog relation writes]`.
- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`.


## 2026-07-02 - Order Affinity Catalog Publisher Deploy Evidence

Current focus: Deploy the guarded Marketing order-affinity publisher with live Catalog writes disabled.

Intent Preservation Chain:

- Vision: Purchase-derived product relationships can feed related products and future bundles without bypassing Catalog ownership.
- Goal Impact: The Marketing publisher code is now live, but cannot mutate Catalog relations until the explicit runtime switch and internal token are configured.
- System: Marketing derives bounded co-purchase candidates from Orders events; Catalog remains the only owner of product relation persistence.
- Feature: Production deployment of guarded order-affinity publisher.
- Task: Deploy commit `f40e417`, pin the Deployment to the immutable image, verify health, startup logs, and disabled publisher env.
- Execution Plan: Run the repo deploy script, then pin the Kubernetes Deployment to `localhost:5000/marketing-microservice:f40e417` because the script sets `latest`; verify without printing secret values.
- Coding Prompt: Confirm the Orders consumer still starts and the Catalog relation publisher remains disabled by default.
- Code: deployed image `localhost:5000/marketing-microservice:f40e417`.
- Validation: deploy completed; rollout succeeded; pod `marketing-microservice-6fcdc7d79b-64z75` reached `1/1 Running`; health returned `200` with `status=ok`; runtime env showed `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=false`; startup logs showed `orders_events_consumer_started` for `orders.order.created.v1` and `orders.order.updated.v1`.

Deployment evidence:

- `./scripts/deploy.sh f40e417` built and pushed image digest `sha256:faccc9975043fbf7d88b0d587146c598a7fbe2053cddf03dcaf20fa82f94b326`.
- The deploy script applied ConfigMap changes and completed successfully.
- `kubectl -n statex-apps set image deployment/marketing-microservice app=localhost:5000/marketing-microservice:f40e417` forced the immutable rollout.
- Health probe via in-pod Node fetch returned `200` and `{"status":"ok","service":"marketing-microservice"}`.
- Runtime env names/values checked for non-secret publisher keys only: `CATALOG_SERVICE_URL`, `CATALOG_ORDER_AFFINITY_BATCH_ENDPOINT`, `CATALOG_ORDER_AFFINITY_TIMEOUT_MS`, `CATALOG_ORDER_AFFINITY_BATCH_SIZE`, and disabled switch `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=false`.

Remaining blockers:

- `[MISSING: runtime Catalog internal service token secret mapping for Marketing-to-Catalog relation writes]`.
- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`.


## 2026-07-02 - Marketing Catalog Internal Token Secret Mapping

Current focus: Remove the runtime secret-mapping blocker without enabling live Catalog relation writes.

Intent Preservation Chain:

- Vision: Purchase-derived related products can be enabled through controlled service-to-service writes while keeping Catalog as relation owner.
- Goal Impact: Marketing can receive the same internal Catalog service token key name used by Catalog's protected internal API guard, but the writer remains disabled until the explicit publish switch and mutation window are approved.
- System: Auth/Vault owns the shared internal token material, Kubernetes ExternalSecret maps it by key name only, Marketing consumes it only when `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true`, and Catalog validates it.
- Feature: Runtime secret readiness for guarded order-affinity publisher.
- Task: Map `CATALOG_INTERNAL_SERVICE_TOKEN` into `marketing-microservice-secret` from the existing Vault property used by Catalog, with no secret value printed and no writer enablement.
- Execution Plan: Inspect secret key names only, update `k8s/external-secret.yaml`, keep ConfigMap publish switch false, validate source, deploy manifest, and verify the key name exists in Kubernetes without exposing the value.
- Coding Prompt: Do not enable live relation writes; only make the protected token available for a later controlled rollout.
- Code: `k8s/external-secret.yaml` and this status entry.
- Validation: `npm run build` passed; `git diff --check` passed; server-side dry-run for `k8s/external-secret.yaml` passed; deploy completed; ExternalSecret reported `Ready=True:SecretSynced`; `marketing-microservice-secret` contains key name `CATALOG_INTERNAL_SERVICE_TOKEN`; pod env contains key name `CATALOG_INTERNAL_SERVICE_TOKEN`; health returned `200` with `status=ok`; publisher switch remains `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=false`.

Deployment evidence:

- Commit `f3f9344` was pushed to GitHub.
- `./scripts/deploy.sh f3f9344` applied the updated ExternalSecret and completed successfully.
- The Deployment was pinned to immutable image `localhost:5000/marketing-microservice:f3f9344`.
- New pod `marketing-microservice-7f8948cb48-snrb6` reached ready state with zero restarts.
- Secret and environment verification listed key names only; no secret values were printed.

Remaining blockers:

- `[MISSING: owner-approved runtime mutation window for first real batch/backfill]`.
- `[MISSING: live publisher enablement evidence with ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true]`.


## 2026-07-02 - Order Affinity Publisher Controlled Write Window

Current focus: Enable Marketing-to-Catalog order-affinity publishing for a controlled first-write smoke.

Intent Preservation Chain:

- Vision: Real Orders co-purchase events can create Catalog-owned product relations for related-product and future bundle surfaces.
- Goal Impact: The guarded publisher moves from ready-but-disabled to enabled for a bounded validation using one synthetic Orders created event with valid Catalog product IDs.
- System: Orders event contract supplies bounded product IDs; Marketing consumes and derives co-purchase relation candidates; Catalog authenticates the service call and owns relation persistence.
- Feature: Live Marketing-to-Catalog order-affinity relation write.
- Task: Set `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true`, deploy, publish one controlled Orders event, verify Catalog relation readback, and inspect logs.
- Execution Plan: Change only Marketing ConfigMap and status docs; do not print secrets; validate build/diff; deploy immutable image; publish one event through RabbitMQ using runtime `RABBITMQ_URL`; verify only relation IDs/status/summary.
- Coding Prompt: Enable the existing guarded publisher without changing payload shape or broadening evidence; keep the smoke event bounded to product IDs and safe metadata.
- Code: `k8s/configmap.yaml` and this status entry.
- Validation: `npm run build` passed; `git diff --check` passed; server-side dry-run for `k8s/configmap.yaml` passed; deploy completed; Deployment pinned to `localhost:5000/marketing-microservice:eeeed8c`; health returned `200` with `status=ok`; runtime switch returned `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=true`; one synthetic Orders created event was published through RabbitMQ; Catalog readback returned both directed `order_affinity` relations with `source=marketing_order_affinity`, `score=1`, and `confidence=0.5`.

Controlled write evidence:

- Event ID: `11111111-2222-4333-8444-000000000001`.
- Order ID: `codex-affinity-smoke-20260702-001`.
- RabbitMQ publish result: `published=true`.
- Source-to-target readback: `ebbdd4fa-5c73-481a-9d07-dbab3d20a150 -> 2d6e4b4c-02a4-4b1c-98c8-afa4ad46a32e`, `relationType=order_affinity`, `source=marketing_order_affinity`.
- Target-to-source readback: `2d6e4b4c-02a4-4b1c-98c8-afa4ad46a32e -> ebbdd4fa-5c73-481a-9d07-dbab3d20a150`, `relationType=order_affinity`, `source=marketing_order_affinity`.
- Readback intentionally omitted raw evidence payload and secret values.
- Recent Marketing error scan showed only pre-existing `audit_log_forward_failed` 404; no Catalog publish failure lines were found.
- Catalog had an unrelated concurrent rollout to image `localhost:5000/catalog-microservice:50e3c0c`; relation readback was rechecked successfully after that rollout settled.

Smoke input:

- Source product: `ebbdd4fa-5c73-481a-9d07-dbab3d20a150`.
- Target product: `2d6e4b4c-02a4-4b1c-98c8-afa4ad46a32e`.
- Synthetic event source: `codex-controlled-smoke`.

Rollback:

- Set `ORDER_AFFINITY_CATALOG_PUBLISH_ENABLED=false` and redeploy Marketing if ongoing live publishing needs to be paused.


## 2026-07-03 - BPCP Holiday Discount Marketing Content Refs

Current focus: Add the Marketing-owned Holiday Discount campaign/content refs lane without delivery, pricing, cart, checkout, deployment, or production data changes.

Intent Preservation Chain:

- Vision: BPCP can coordinate a Holiday Discount pilot while each service keeps its own domain ownership.
- Goal Impact: Downstream services can read Marketing-owned content refs for `holiday-discount-2026` later without treating Marketing as the discount calculator, cart owner, checkout owner, or notification delivery provider.
- System: BPCP owns process orchestration, Marketing owns campaign/content references, Notifications owns delivery/provider execution, and pricing/cart/checkout services own monetary behavior.
- Feature: Holiday Discount Marketing content-ref contract.
- Task: Add typed slots, process refs, read-only contract endpoint, fail-closed validation, tests, and adoption documentation for `holiday-2026-main`.
- Execution Plan: Edit only Marketing-owned source/tests/docs; avoid BPCP/Catalog/Notifications/pricing/cart/checkout/Kubernetes/deploy/secrets/production data.
- Coding Prompt: Preserve `processId=holiday-discount-2026`, `processVersion=1`, `policyRef=holiday-10-percent-selected-categories`, `campaignRef=holiday-2026-main`, expose refs for `product_badge`, `cart_banner`, `upsell_block`, and `post_purchase_message`, and reject execution/delivery fields in content metadata.
- Code: `src/types.ts`, `src/campaign-blueprints.ts`, `src/api-contracts.ts`, `src/main.ts`, `test/campaign-blueprints.test.ts`, `test/api-contracts.test.ts`, `docs/business-process-control-plane/HOLIDAY_DISCOUNT_ADOPTION.md`, `docs/agents/contracts/marketing-campaign-contract.md`, and `docs/orchestrator/GOALS.md`.
- Validation: pending current session commands.

Remaining blockers:

- `[MISSING: canonical BPCP campaign content API path and response envelope]`.
- `[MISSING: notification template provider contract for Holiday Discount template refs]`.
- `[MISSING: localized copy approval and template asset source of truth]`.


## 2026-07-03 - Order Affinity Historical Backfill CLI

Current focus: Marketing-owned historical order-affinity aggregation from the Orders replay export.

Intent Preservation Chain:

- Vision: Real customer purchase history can feed related-product and future bundle surfaces across storefronts.
- Goal Impact: Marketing can aggregate historical co-purchase evidence and publish Catalog relation candidates through the existing guarded Catalog writer.
- System: Orders owns replay source data; Marketing owns aggregation/idempotency/publish orchestration; Catalog owns product-relation persistence.
- Feature: `backfill:order-affinity` dry-run/publish command with Orders replay input.
- Task: Add a CLI that reads the bounded Orders replay endpoint or JSON input, aggregates directed product pairs, strips raw order IDs from public output, and uses internal-service auth for Orders.
- Execution Plan: Keep publish disabled unless `--publish` is explicit and existing Catalog publish env is enabled; validate with tests/build; deploy immutable image; start with dry-run.
- Coding Prompt: Reuse the existing Orders lifecycle parser and Catalog candidate shape; do not expose customer/address/payment details; do not write Catalog relations during dry-run.
- Code: `src/order-affinity-backfill.ts`, `test/order-affinity-backfill.test.ts`, `k8s/external-secret.yaml`, `k8s/secret.yaml.example`, and `package.json`.
- Validation: `npm run test -- --test-name-pattern="order affinity backfill"` passed with 93 tests; `npm run build` and `git diff --check` passed.

Deployment and runtime evidence:

- Commits pushed: `e04d155` added the backfill CLI; `d293415` switched Orders fetches to internal-service auth and mapped `ORDERS_SERVICE_TOKEN`.
- Current deployed image: `localhost:5000/marketing-microservice:d293415`.
- ExternalSecret `marketing-microservice-secret` is `Ready=True`; pod environment includes `ORDERS_SERVICE_TOKEN` and `CATALOG_INTERNAL_SERVICE_TOKEN` key names only.
- Initial live command succeeded: `node dist/order-affinity-backfill.js --orders-url http://orders-microservice.statex-apps.svc.cluster.local:3203 --limit=50 --dry-run --pretty`; at that time Orders replay returned `inputRecords=0`, `acceptedCreatedEvents=0`, `aggregatePairs=0`, `candidates=[]`.
- After the owner-approved FlipFlop paid multi-item checkout smoke reached central Orders payment status `paid`, `kubectl -n statex-apps exec deploy/marketing-microservice -- node dist/order-affinity-backfill.js --orders-url http://orders-microservice.statex-apps.svc.cluster.local:3203 --channel=flipflop --limit=20 --dry-run --pretty` returned `inputRecords=2`, `acceptedCreatedEvents=2`, `rejectedRecords=0`, `aggregatePairs=2`, `totalPairEvidence=4`, and two directed candidates for Catalog products `ce4a51aa-2d12-4ab7-a965-7a36609d01fc` and `dbc51dde-fc66-4511-b178-f929183f4647` with `score=2`, `confidence=0.65`, `source=marketing_order_affinity`.
- No Catalog publish was attempted in the FlipFlop smoke dry-run.

Remaining blockers:

- `[MISSING: owner-reviewed publish window before running a future non-empty `--publish` central Orders backfill]`.


## 2026-07-03 - Central Orders FlipFlop Order Affinity Publish Window

Current focus: Owner-approved publish window for the non-empty central Orders FlipFlop replay candidates.

Intent Preservation Chain:

- Vision: Central Orders paid multi-product history can safely improve Catalog-owned related-product and future bundle surfaces.
- Goal Impact: The previously dry-run-only FlipFlop central Orders evidence is now published to Catalog as durable `order_affinity` relations.
- System: Orders owns paid order replay source data; Marketing owns aggregation/idempotency/publish orchestration; Catalog owns product-relation persistence and readback.
- Feature: Central Orders FlipFlop order-affinity publish window.
- Task: rerun dry-run, run `--publish` with an explicit run id, verify Catalog audit/readback, and record evidence without exposing customer/payment/secret data.
- Execution Plan: Use deployed Marketing CLI from the running pod, filter `--channel=flipflop`, keep output bounded to product IDs and aggregate counts, and verify Catalog by authenticated relation reads.
- Coding Prompt: Do not print secrets, customer data, addresses, payment payloads, or raw order rows; do not broaden publish scope beyond the owner-reviewed non-empty FlipFlop replay.
- Code: no Marketing source code change; runtime operation used deployed image `localhost:5000/marketing-microservice:latest` and this status entry records evidence.
- Validation: dry-run, publish result, Catalog audit log, and Catalog relation readback passed.

Runtime evidence:

- Dry-run command: `node dist/order-affinity-backfill.js --orders-url http://orders-microservice.statex-apps.svc.cluster.local:3203 --channel=flipflop --limit=20 --dry-run --pretty`.
- Dry-run result: `inputRecords=2`, `acceptedCreatedEvents=2`, `rejectedRecords=0`, `aggregatePairs=2`, `totalPairEvidence=4`, `byChannel.flipflop=2`.
- Publish command: `node dist/order-affinity-backfill.js --orders-url http://orders-microservice.statex-apps.svc.cluster.local:3203 --channel=flipflop --limit=20 --run-id central-orders-flipflop-paid-20260703 --publish --pretty`.
- Publish result: `status=published`, `candidateCount=2`, `batchCount=1`, endpoint `/api/internal/product-relations/order-affinity/batch`.
- Catalog audit: idempotency key `marketing_order_affinity:backfill:central-orders-flipflop-paid-20260703:1`, `total=2`, `upserted=0`, `updated=2`, `failed=0`.
- Catalog readback: `ce4a51aa-2d12-4ab7-a965-7a36609d01fc -> dbc51dde-fc66-4511-b178-f929183f4647` and reciprocal relation both returned `relationType=order_affinity`, `source=marketing_order_affinity`, `score=2`, `confidence=0.65`, `evidenceChannel=flipflop`.

Boundary decision: no broad historical publish, customer/address/payment/provider payload output, direct database write, secret output, source code change, deployment, migration, or marketplace action was performed.

Remaining blockers:

- `[MISSING: scheduled/idempotent central Orders backfill policy for future runs beyond this owner-reviewed window]`.


## 2026-07-03 - Allegro Historical Order Affinity Backfill

Current focus: Execute a bounded operational backfill from Allegro paid multi-product orders into Catalog product relations.

Intent Preservation Chain:

- Vision: Marketplace purchase history can improve related-product and future bundle surfaces across the ecosystem.
- Goal Impact: Allegro paid multi-product orders now contribute real co-purchase evidence to Catalog-owned `order_affinity` relations.
- System: Allegro owns marketplace order history; Marketing owns aggregation/publish orchestration; Catalog owns relation persistence. This run used a temporary bounded export and does not replace the future Allegro-owned replay API.
- Feature: One-time Allegro order-affinity backfill through the existing Marketing CLI and Catalog batch writer.
- Task: Export only paid `READY_FOR_PROCESSING` Allegro orders with at least two distinct Catalog product IDs, dry-run candidates, publish one small batch, and verify Catalog readback.
- Execution Plan: Use temporary `/tmp` JSON on `alfares`; no customer fields, buyer fields, addresses, raw marketplace payloads, or secret values; publish only after dry-run produces a small deterministic batch.
- Coding Prompt: Preserve Allegro provenance via `channel=allegro` and `runId=allegro-history-20260703`; use existing Marketing/Catalog guarded writer; do not persist temporary export files in a repo.
- Code: No Marketing source changes in this step; used deployed `node dist/order-affinity-backfill.js` from image `localhost:5000/marketing-microservice:d293415`.
- Validation: dry-run accepted 8 records, rejected 0, produced 16 directed candidates; publish returned `status=published`, `candidateCount=16`, `batchCount=1`; Catalog audit logged `upserted=16`, `failed=0`.

Runtime evidence:

- Source aggregate: Allegro DB contained 8 paid `READY_FOR_PROCESSING` orders with two distinct Catalog products each.
- Dry-run command shape: `node dist/order-affinity-backfill.js --run-id allegro-history-20260703 --limit=50 --dry-run --pretty`.
- Publish command shape: `node dist/order-affinity-backfill.js --run-id allegro-history-20260703 --limit=50 --publish --pretty`.
- Catalog idempotency key: `marketing_order_affinity:backfill:allegro-history-20260703:1`.
- Catalog readback: `product_relations` now has 16 rows where `source=marketing_order_affinity`, `relation_type=order_affinity`, and `evidence.channel=allegro`; all have `score=1` and `confidence=0.5`.
- Temporary export files were stored under `/tmp` on `alfares` only and are not repository artifacts.

Remaining blockers:

- `[MISSING: Allegro-owned protected replay endpoint so future runs do not require a temporary SQL export]`.
- `[MISSING: scheduled/idempotent marketplace-wide backfill orchestration across Allegro, Aukro, Bazos, FlipFlop, and central Orders]`.
