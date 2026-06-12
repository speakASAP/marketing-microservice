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
