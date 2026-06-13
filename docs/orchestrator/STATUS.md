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
