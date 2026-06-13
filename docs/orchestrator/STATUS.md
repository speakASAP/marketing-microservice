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
