# Marketing Implementation Plan

## Execution Rule

Plan for maximum safe parallelism. Default to several small, independently owned workstreams when their files, schemas, contracts, and validation paths do not conflict. Keep work serial only when one chunk consumes another chunk's schema, API, migration, runtime behavior, or approval/security foundation.

Every implementation session must preserve Marketing as the campaign and segmentation control plane: Marketing owns campaign, segment, journey, run, decision, consent-enforcement, frequency-cap, throttling, and audit state; notifications owns outbound provider execution; auth and leads own identity, contact data, preferences, and consent; domain/app services own their source signals.

## Current Program

Phase 1 core implementation is complete through Goal 7. Ecosystem expansion Goals 8-13 are complete.

Current next serial implementation chunk: review/commit the integrated remote worktree. Goal 15 is the explicit prerequisite gate for protected Goal 16/17/18 UI work and is satisfied by the reconciled admin auth/RBAC evidence; after the integration commit, launch disjoint Goal 16/17, Goal 18.3-18.5, and Goal 19.4/19.5 workstreams. Goal 20 enforcement remains blocked by missing owner-approved production policy decisions.

Do not execute real campaigns or real journey steps against real recipients without explicit owner approval. Journey execution must reuse existing campaign execution safety gates and notification delegation.

## Source Of Truth Notes

- `STATE.json` is the current checkpoint source for next focus and completed chunks.
- `docs/orchestrator/GOALS.md` is the canonical goal backlog and acceptance criteria.
- `TASKS.md` is a coordinator queue and must not override completed evidence in `STATUS.md` or `STATE.json`.
- When these files disagree, the coordinator must reconcile them before assigning parallel agents.
- Goal 15 is the explicit gate for protected Goal 16/17/18 UI work. If Goal 15 is not `done` in `GOALS.md` and complete in `STATE.json`/`STATUS.md`, Goal 16/17/18 UI workers must remain blocked.

## Parallel Planning Standard

Each future plan or handoff must include:

- Independently startable goals or chunks.
- Blockers for each goal, naming the exact missing prerequisite, decision, credential, contract, schema, file, or validation evidence.
- Recommended agent/session owner.
- Allowed files and forbidden files for each agent.
- Expected output and validation command for each workstream.
- Integration order for shared contracts, public APIs, database schemas, generated artifacts, or shared UI shells.
- A final integration/validation workstream that runs after parallel branches merge.

If two agents need to edit the same file, same migration chain, same public contract, same route namespace, same DTO/schema, or same generated artifact, those pieces are not parallel until a coordinator assigns an integration owner and merge order.

## Current Parallel Execution Assessment

### Track A - Goal 16 Campaign And Segment Admin Console

Status: Goal 15 gate satisfied; ready after current integration commit.

Recommended owner: campaign-admin-ui agent.

Intent: Add protected browser workflows for Marketing-owned campaign and segment state without weakening backend approval, dry-run, idempotency, consent, unsubscribe, frequency-cap, throttling, max-send, max-30 chunking, registry validation, or notification delegation gates.

Allowed files: admin campaign/segment UI modules, admin API adapters that call existing protected Marketing endpoints, admin UI tests, docs/orchestrator/STATUS.md evidence.

Forbidden files: auth session/RBAC core unless a trivial integration import is needed, runs/audit/channel views, analytics dashboards, notification provider implementation, auth/leads source-of-truth models, direct campaign sending behavior.

Blockers: Goal 15 admin auth/RBAC gate is satisfied; current remote integration worktree should be reviewed/committed first to avoid racing integrated admin files.

Expected output: campaign and segment CRUD screens, dry-run preview, approval workflow, and scheduling/pause/archive controls protected by the Goal 15 admin shell.

Validation: npm run build; npm test; rendered desktop/mobile admin checks; unauthorized admin rejection; no browser service-token exposure.

Integration order: merge after Goal 14/15 integration commit. Coordinate shared admin navigation labels with Track B before merge.

### Track B - Goal 17 Runs, Consent, Channels, And Audit Views

Status: Goal 15 gate satisfied; ready after current integration commit.

Recommended owner: operations-admin-ui agent.

Intent: Expose explainability and safety state while preserving source ownership for auth/leads preferences, notifications channel registry, and redacted audit evidence.

Allowed files: admin runs/outcomes/audit/consent/channel read views, unsubscribe intake UI using existing public/source-owned contract, admin UI tests, docs/orchestrator/STATUS.md evidence.

Forbidden files: campaign/segment create/edit views, analytics dashboards, notification provider implementation, auth/leads contact or consent source models, direct delivery behavior.

Blockers: Goal 15 admin auth/RBAC gate is satisfied; current remote integration worktree should be reviewed/committed first. Read-only channel registry behavior must not expose provider credentials.

Expected output: run search/detail, source-owned consent/preference lookup, unsubscribe intake, read-only channel registry view, redacted audit evidence view, and correlation ID search.

Validation: npm run build; npm test; rendered admin checks; redaction checks for tokens, message bodies, recipient addresses, and provider credentials.

Integration order: merge after Goal 14/15 integration commit. Coordinate shared admin navigation labels with Track A before merge.

### Track C - Goal 18 Analytics And Attribution Follow-Up

Status: Goal 15 gate satisfied for protected dashboard UI; ready after current integration commit for Goal 18.3-18.5 subject to analytics ownership blockers.

Recommended owner: analytics-dashboard agent.

Completed evidence: Goal 18.1 and 18.2 have normalized Marketing-owned event builders and externally supplied attribution fact joining with redaction tests.

Remaining scope: add campaign attribution metadata, decide whether analytics read models are local or analytics-service-backed, and build dashboard charts/exportable summaries.

Intent: Business users can evaluate campaign value by tenant, app, channel, segment, and lifecycle stage while Marketing emits campaign facts without owning all app/customer/revenue truth.

Allowed files: analytics/attribution metadata, analytics read-model or analytics-service adapter files, dashboard UI files, analytics tests, docs/orchestrator/STATUS.md evidence.

Forbidden files: campaign/segment admin create/edit views owned by Goal 16, runs/audit/channel operational views owned by Goal 17, notification provider implementation, auth/leads source-of-truth models, CRM master-data ownership.

Blockers: Goal 15 admin auth/RBAC gate is satisfied for protected dashboard UI; [MISSING: approved analytics/conversion owner contract] for any attribution truth beyond Marketing-owned campaign facts and externally supplied facts.

Expected output: dashboard distinguishes sent, skipped, failed, delivered, converted, and attributed value while preserving source ownership and redaction.

Validation: npm run build; npm test; rendered dashboard checks; event/redaction checks; no raw recipient addresses, message bodies, provider credentials, or service tokens in analytics output.

Integration order: merge after Goal 14/15/18.1-18.2/19.3 integration commit. Coordinate shared admin navigation with Goal 16/17 before dashboard merge.

### Track D - Goal 19 CRM/Account Follow-Up

Status: ready after integration commit for Goal 19.4 and 19.5.

Recommended owner: CRM/account campaign-contract agent.

Intent: Add B2B account segment rule coverage, campaign blueprints, and broader safe-failure/audit evidence using the read-only crm_accounts source without making Marketing the CRM/account master-data owner.

Allowed files: CRM/account segment rule tests, campaign blueprint/catalog docs or static blueprint data, safe-failure/audit tests for crm_accounts, relevant contract/status evidence.

Forbidden files: CRM master-data migrations, CRM account ownership models, auth/leads source-of-truth models, notification provider implementation, direct delivery behavior, admin UI files owned by Goal 16/17.

Blockers: production use remains disabled until CRM_ACCOUNT_SERVICE_URL and source-service auth are configured, but 19.4/19.5 implementation can use the generated read-only contract and tests.

Expected output: B2B onboarding/renewal/upsell/winback rules and blueprints remain dry-run/approval-gated; CRM source failures produce safe audit evidence before notification delegation.

Validation: npm run build; npm test; targeted tests for crm_accounts rules, blueprints, source failure, and audit evidence.

Integration order: merge after Goal 14/15/19.3 integration commit and keep files isolated from Goal 16/17 admin UI tracks.

### Track E - Goal 20 Governance Enforcement

Status: blocked.

Blockers: [MISSING: production risk thresholds], [MISSING: high-risk approver identities], [MISSING: quiet-hour policy defaults], [MISSING: owner-approved deployment/rollback procedure], and production Auth role grant evidence.

Decision: keep policy/playbook drafts discoverable; do not add enforcement code or deploy without owner-approved policy inputs.

## Parallel Execution Notes

Shared files/contracts: admin shell navigation, admin CSS/static layout, protected admin route adapters, and docs/orchestrator/STATUS.md.

Integration owner: original coordinator thread should review and commit the current remote worktree before launching new worker edits.

Validation owner: final integration owner for the next wave must run remote npm run build, npm test, rendered admin checks, unauthorized access checks, and token/redaction checks.

Merge order: Goal 14/15 integration commit first; then Goal 18.1/18.2 contract/event work if isolated; then Goal 16 and Goal 17 UI tracks in a coordinator-defined order for shared navigation; finally Goal 18 dashboard UI after analytics contract and admin navigation settle.

## Coordinator Assignment Template

For each agent, provide:

```text
Goal/chunk:
Start status: start now | wait for <dependency> | blocked by <blocker>
Preserved intent:
Allowed files:
Forbidden files:
Expected output:
Validation:
Integration notes:
Status update requirement: append evidence to docs/orchestrator/STATUS.md without overwriting other agents' entries.
```

## Phase 5 - Lifecycle And CRM Signals

Goal 13 lifecycle journeys are complete through scheduler, dry-run preview, and step decision audit evidence. Goal 19 integrates future CRM/account signals as read-only segmentation inputs. Runtime CRM client work remains blocked until a real CRM/account service contract exists.

## Phase 6 - Public Landing And Admin Console

Goal 14 public landing work can begin in parallel if it does not depend on protected admin data. Goal 15 admin auth/RBAC is the prerequisite for Goals 16 and 17. Goal 16 and Goal 17 should be assigned after Goal 15 establishes route protection and session contracts.

## Phase 7 - Analytics And Production Governance

Goal 18 event/contract planning and Goal 20 governance docs can begin in parallel. Goal 18 dashboard UI should wait for Goal 15. Goal 20 enforcement code should wait for the relevant runtime and admin foundations.

## Validation Standard

For code changes, run remotely:

```bash
npm run build
npm test
```

For frontend changes, also validate rendered desktop/mobile UI, anonymous admin rejection, token non-exposure, and responsive layouts.

For contract or governance documentation changes, validate traceability against `docs/orchestrator/GOALS.md`, `docs/orchestrator/STATUS.md`, and the relevant `docs/agents/contracts/*` files.

For deployment, require explicit owner approval before running:

```bash
./scripts/deploy.sh
```

No real campaign execution is allowed without explicit owner approval.
