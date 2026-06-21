# Marketing Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

## Goal 1 - Intent Preservation And Contract Baseline

Status: done

Intent: Marketing must preserve its role as the campaign orchestration service before further implementation.

Chunks:

- [x] 1.1 Create marketing-local intent preservation docs and master prompt.
- [x] 1.2 Update `AGENTS.md` to require the orchestrator pack.
- [x] 1.3 Backfill referenced contract docs under `docs/agents/contracts`.
- [x] 1.4 Confirm README references are satisfied by the restored compatibility docs.

Acceptance criteria:

- `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, and `PROMPTS.md` exist.
- `AGENTS.md` tells future agents to follow the orchestrator pack before implementation.
- Existing root intent files remain preserved.
- Stale documentation references are either created or corrected.

## Goal 2 - External Source Integration

Status: done

Intent: Marketing segment execution must use real auth/leads data instead of in-memory stub contacts.

Chunks:

- Add auth users client for registered-user contact, preferences, and consent.
- Add leads client for lead contact, preferences, and consent.
- Add order/catalog signal client only where segment rules require it.
- Preserve in-memory test fixtures behind tests only.

Acceptance criteria:

- Runtime execution no longer depends on hardcoded contact fixtures.
- Consent and unsubscribe checks use source-owned data.
- API failures produce safe skips or failed runs without direct sending.
- `npm run build` and `npm test` pass.

## Goal 3 - Persistence And Execution State

Status: done

Intent: Campaigns, segments, runs, delivery outcomes, and suppression evidence must survive process restarts.

Chunks:

- Add PostgreSQL schema/migrations for segments, campaigns, runs, outcomes, suppression, and idempotency keys.
- Replace in-memory maps with repository interfaces backed by PostgreSQL.
- Preserve test reset helpers using isolated test stores or database fixtures.

Acceptance criteria:

- Campaign CRUD and execution state persist across restarts.
- Idempotency works across restarts.
- Delivery outcomes include consent, skip, failure, and sent evidence.
- `npm run build` and `npm test` pass.

## Goal 4 - Campaign Approval And Safety Gates

Status: done

Intent: Real campaign execution must require explicit owner approval and safe operational limits.

Chunks:

- Add campaign approval state and approval actor metadata.
- Require approval for scheduled or manual execution against real recipients.
- Add dry-run mode that resolves recipients and decisions without delivery.
- Enforce max sends per run and max chunk size with clear errors.

Acceptance criteria:

- Draft or unapproved campaigns cannot execute against real recipients.
- Dry-run produces recipient counts, skip reasons, and channel decisions without notification calls.
- Real execution records approval evidence.
- `npm run build` and `npm test` pass.

## Goal 5 - Scheduling, Throttling, And Frequency Controls

Status: done

Intent: Scheduled and recurring campaigns must run predictably while protecting recipients.

Chunks:

- Add scheduler ownership and locking rules.
- Implement per-campaign throttle and frequency-cap persistence.
- Add recurring campaign model if explicitly required by owner.
- Add operational visibility for pending, running, completed, failed, and paused runs.

Acceptance criteria:

- Duplicate schedulers cannot double-send the same run.
- Frequency caps are enforced across persisted history.
- Paused campaigns do not execute.
- `npm run build` and `npm test` pass.

## Goal 6 - Audit Logging And Compliance Evidence

Status: done

Intent: Marketing must produce audit-grade evidence for campaign and recipient decisions.

Chunks:

- Send structured logs to logging-microservice where available.
- Add audit fields for campaign create/update/approval/execution.
- Record unsubscribe and consent-decision evidence without exposing secrets.
- Add correlation IDs for cross-service notification calls.

Acceptance criteria:

- Logs include ISO timestamp and `duration_ms` where relevant.
- Campaign execution can explain every sent, skipped, or failed recipient.
- No sensitive tokens or message secrets are logged.
- `npm run build` and `npm test` pass.

## Goal 7 - API Contract Hardening

Status: done

Intent: Marketing APIs must be stable enough for Statex applications and service-to-service consumers.

Chunks:

- Define request/response contracts for campaigns, segments, executions, dry runs, and preferences/unsubscribe.
- Add validation for required fields, channel names, purposes, and schedule values.
- Add service auth/RBAC boundary for writes and execution.
- Add contract tests or smoke scripts.

Acceptance criteria:

- Invalid campaign, segment, and execution requests fail with stable errors.
- Protected operations require service/user authorization.
- Public unsubscribe/preference endpoints follow documented contract.
- `npm run build` and `npm test` pass.

## Goal 8 - Ecosystem Ownership Contract Baseline

Status: done

Intent: Marketing must define the expanded ecosystem ownership model before adding multi-application, CRM-like, analytics, landing page, or admin-dashboard capabilities.

Chunks:

- [x] 8.1 Create ecosystem ownership contracts for tenant/app/business registry, CRM/account scope, analytics, app signals, and marketing orchestration.
- [x] 8.2 Define application portfolio taxonomy for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.
- [x] 8.3 Define CRM/account boundary and confirm Marketing will not own CRM master data.
- [x] 8.4 Define required contract changes for auth, leads, notifications, domain/app services, registry, analytics, and future CRM/account service.

Acceptance criteria:

- Ownership contracts identify exactly which service owns each data domain.
- Marketing remains campaign and segmentation control plane only.
- CRM/account master data is explicitly assigned outside Marketing.
- Required cross-service contract changes are documented before implementation.

## Goal 9 - Tenant/App Registry Integration

Status: done

Intent: Campaigns and segments must be scoped to canonical tenant/app/brand identifiers without Marketing owning tenant truth.

Chunks:

- [x] 9.1 Add tenant/app/business registry contract and environment keys.
- [x] 9.2 Add campaign and segment metadata for tenantId, appId, brandId, locale/timezone, product line, and lifecycle scope.
- [x] 9.3 Add registry validation client with safe failure behavior.
- [x] 9.4 Add tenant/app filters and contract tests.

Acceptance criteria:

- Campaigns and segments carry canonical tenant/app scope.
- Invalid registry references fail with stable errors before execution.
- Missing registry service fails safely and does not send.
- Marketing stores references, not tenant truth.

## Goal 10 - Cross-Service Recipient And Consent Contract Hardening

Status: done

Intent: Recipient resolution must support tenant/app/purpose/channel consent without duplicating auth/leads truth.

Chunks:

- [x] 10.1 Define auth registered-user recipient contract by tenant/app/purpose/channel.
- [x] 10.2 Define leads recipient contract by tenant/app/purpose/channel.
- [x] 10.3 Define lead-to-user conversion and identity-linking behavior.
- [x] 10.4 Define unsubscribe write-through or source-owned write contracts.
- [x] 10.5 Update source clients and tests after provider contracts exist.

Acceptance criteria:

- Marketing can enforce tenant/app/purpose/channel consent.
- Auth and leads remain the sources of truth.
- Lead conversion does not duplicate contact records in Marketing.
- Source outages skip/fail safely without notification delivery.

## Goal 11 - Application Signal Segmentation Contracts

Status: done

Intent: Marketing can segment by app behavior while apps remain the source of event truth and do not become campaign engines.

Chunks:

- [x] 11.1 Define common application signal envelope.
- [x] 11.2 Define signal catalog for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.
- [x] 11.3 Add signal source client or event ingestion contract.
- [x] 11.4 Add segment rules for app events and lifecycle states.
- [x] 11.5 Add dry-run preview support and failure evidence.

Acceptance criteria:

- App signals include tenant/app/subject/time/source metadata.
- Marketing owns segment definitions, not raw application truth.
- Each app can contribute signals without implementing campaigns.
- Tests cover each signal class and safe failure behavior.

## Goal 12 - Multi-Application Campaign Catalog

Status: done

Intent: Business users need a shared catalog of campaign families, lifecycle stages, audiences, and templates across applications.

Chunks:

- [x] 12.1 Add campaign catalog metadata model.
- [x] 12.2 Add lifecycle stage and campaign family enums/contracts.
- [x] 12.3 Add application-specific default campaign blueprints.
- [x] 12.4 Add catalog APIs and filters.
- [x] 12.5 Add migration and tests.

Acceptance criteria:

- Campaigns can be discovered by tenant, app, product line, lifecycle stage, and purpose.
- Blueprints do not execute without explicit owner approval.
- Template references remain references; Marketing does not own provider template delivery.

## Goal 13 - Lifecycle Journey Engine

Status: done

Intent: Marketing can orchestrate approved multi-step customer journeys with safety controls.

Chunks:

- [x] 13.1 Add journey definitions, steps, triggers, exit rules, and suppression rules.
- [x] 13.2 Add approval gate for journey activation.
- [x] 13.3 Add scheduler/idempotency integration for journey steps.
- [x] 13.4 Add dry-run preview for journey enrollment and next actions.
- [x] 13.5 Add audit evidence for step decisions.

Acceptance criteria:

- Journey steps cannot send directly or bypass notifications.
- Approval, consent, unsubscribe, frequency caps, max-send, throttling, and max-30 chunking remain enforced.
- Exit/suppression rules prevent repeated or stale journey sends.

## Goal 14 - Landing Page And Auth Entry Points

Status: done

Intent: Business users need a public entry point that explains the Marketing platform and routes users to auth-owned registration/login.

Chunks:

- [x] 14.1 Add frontend build pipeline and static serving.
- [x] 14.2 Build landing page for Marketing platform capabilities.
- [x] 14.3 Add register, login, and admin buttons.
- [x] 14.4 Route login/register through auth-microservice with return URLs.
- [x] 14.5 Add deployment/static asset validation.

Acceptance criteria:

- Public landing page is accessible without auth.
- Register and login are delegated to auth-microservice.
- Admin button routes to protected admin shell.
- No service tokens or campaign execution controls are exposed publicly.

## Goal 15 - Admin Auth And RBAC Shell

Status: done

Intent: Only authenticated and authorized users can access Marketing admin capabilities.

Chunks:

- [x] 15.1 Add auth session verification with auth-microservice.
- [x] 15.2 Add role/permission mapping for viewer/operator/admin/owner.
- [x] 15.3 Add /admin/api/session and admin route protection.
- [x] 15.4 Add admin layout shell and navigation.
- [x] 15.5 Add contract tests for unauthorized and role-specific access.

Acceptance criteria:

- Anonymous users cannot access admin data.
- Browser never receives service tokens.
- RBAC is enforced server-side.
- Existing service-token API consumers remain compatible.

Operational note:

- Production Auth role grants for marketing_viewer, marketing_operator, marketing_admin, and marketing_owner still require operations evidence before broad admin rollout.

## Goal 16 - Campaign And Segment Admin Console

Status: done

Intent: Operators can manage Marketing-owned campaign and segment state safely from the browser.

Chunks:

- [x] 16.1 Build campaigns list/detail/create/edit views.
- [x] 16.2 Build segment list/detail/create/edit views.
- [x] 16.3 Add dry-run preview UI.
- [x] 16.4 Add approval workflow UI.
- [x] 16.5 Add campaign scheduling and pause/archive controls.

Acceptance criteria:

- UI validates the same constraints as backend contracts.
- Read-only approval fields cannot be edited directly.
- Dry-run does not call notifications.
- Real execution remains approval-gated and idempotent.

## Goal 17 - Runs, Consent, Channels, And Audit Admin Views

Status: done

Intent: Operators can explain campaign decisions and inspect safety state without taking over other services ownership.

Chunks:

- [x] 17.1 Build run list/detail and outcome search.
- [x] 17.2 Build consent/preference lookup and unsubscribe intake view.
- [x] 17.3 Build read-only notification channel registry view.
- [x] 17.4 Build audit evidence view with redaction.
- [x] 17.5 Add correlation ID search.

Acceptance criteria:

- Every sent/skipped/failed outcome is explainable.
- Consent view preserves auth/leads ownership.
- Channel view is read-only and does not expose provider credentials.
- Audit view redacts secrets, message bodies, and recipient addresses.

## Goal 18 - Analytics And Attribution Dashboard

Status: done

Intent: Business users can evaluate campaign value by tenant, app, channel, segment, and lifecycle stage.

Chunks:

- [x] 18.1 Emit normalized marketing events.
- [x] 18.2 Define conversion/correlation contract with app services and analytics.
- [x] 18.3 Add campaign attribution metadata.
- [x] 18.4 Build analytics read models or analytics-service integration.
- [x] 18.5 Build dashboard charts and exportable summaries.

Acceptance criteria:

- Marketing emits campaign facts but does not own all app/customer truth.
- Attribution uses stable campaign, run, recipient, correlation, tenant, and app IDs.
- Dashboard distinguishes sent, skipped, failed, delivered, converted, and attributed revenue/value.

Integration note:

- Goal 18 is complete for Marketing-owned campaign analytics, externally supplied attribution facts, protected dashboard charts, and CSV summaries. Broader attribution, conversion, revenue/value, customer, funnel, and app behavior truth remains externally owned and gated by `[MISSING: approved analytics/conversion owner contract]`.

## Goal 19 - CRM/Account Service Integration

Status: done

Intent: Marketing can use B2B account lifecycle signals without owning CRM master data.

Chunks:

- [x] 19.1 Define CRM/account read-only signal contract.
- [x] 19.2 Define account, opportunity, lifecycle stage, owner, health, and onboarding status fields.
- [x] 19.3 Add CRM signal source client using the generated read-only contract; production use remains disabled until CRM_ACCOUNT_SERVICE_URL is configured.
- [x] 19.4 Add B2B account segment rules and campaign blueprints.
- [x] 19.5 Add safe failure and audit evidence.

Acceptance criteria:

- CRM/account source remains the master owner.
- Marketing stores references and campaign decisions only.
- B2B onboarding, renewal, upsell, and winback campaigns can be dry-run before approval.

Operational note:

- Production CRM/account use remains gated by CRM_ACCOUNT_SERVICE_URL, auth/token configuration, and approved source-owned service readiness.

## Goal 20 - Production Governance And Readiness

Status: done

Intent: The expanded platform must be safe for production marketing operations.

Chunks:

- [x] 20.1 Add campaign risk classification policy draft.
- [x] 20.2 Add high-risk approval workflow policy draft.
- [x] 20.3 Add quiet-hour and tenant/app policy guardrail proposal.
- [x] 20.4 Add real-execution confirmation and rollback/incident/unsubscribe playbook draft.
- [x] 20.5 Add production readiness validation and deployment checklist draft.
- [x] 20.6 Add runtime enforcement with conservative AI-approved production defaults.

Acceptance criteria status:

- Runtime enforcement now classifies risk, requires current dry-run evidence, readiness and rollback references, non-automation approval evidence, quiet-hour compliance, source-health, and stronger high-risk/restricted evidence before real notification delegation.
- Documentation defines conservative Auth/RBAC role mapping, analytics/conversion ownership, thresholds, approver evidence sources, quiet-hour defaults, emergency override rules, and AI-approved deployment/rollback procedure.
- Operational playbooks exist for deploy, rollback, incident review, unsubscribe escalation, and production governance evidence.

Documentation closeout evidence:

- `docs/agents/contracts/production-governance-readiness-contract.md` defines Goal 20.1-20.3 risk, approval, quiet-hour, and tenant/app guardrail policy drafts.
- `docs/operations/production-readiness-playbook.md` defines Goal 20.4-20.5 deploy, rollback, incident, unsubscribe escalation, and readiness checklist drafts.
- Enforcement implemented in src/production-governance.ts and src/executor.ts; metadata contract is accepted through catalogMetadata.governance and documented in the production governance contract.
