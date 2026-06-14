# Marketing Goal Prompts

Use these prompts when the owner asks to "implement the next marketing goal."

## Universal Session Prompt

Read `BUSINESS.md`, `SYSTEM.md`, `README.md`, `TASKS.md`, `STATE.json`, `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, `PROMPTS.md`, and the required contract docs. Identify the active chunk, next ready chunks, blocked chunks, and independently startable parallel workstreams. Restate the preserved marketing intent and affected ownership boundaries. Implement only the assigned chunk, verify it, append status evidence, and leave the next chunks and blockers clearly named.


## Parallel Agent Handoff Prompt

Use this when assigning work to multiple sessions:

```text
Goal/chunk:
Start status: start now | wait for <dependency> | blocked by <blocker>
Preserved intent:
Allowed files:
Forbidden files:
Expected output:
Validation:
Integration order:
Status update requirement: append evidence to docs/orchestrator/STATUS.md without overwriting other agents' entries.
```

Do not assign two agents to the same file, migration chain, public contract, route namespace, DTO/schema, generated artifact, or security boundary unless one agent is explicitly the integration owner.

## Goal 1 Prompt

Implement the next unfinished chunk of "Goal 1 - Intent Preservation And Contract Baseline." Preserve existing root documentation and create or correct only documentation needed for the Intent Preservation system.

## Goal 2 Prompt

Implement the next unfinished chunk of "Goal 2 - External Source Integration." Replace runtime stub contacts with auth/leads clients while keeping contact and consent ownership in auth/leads. Do not implement direct delivery.

## Goal 3 Prompt

Implement the next unfinished chunk of "Goal 3 - Persistence And Execution State." Move campaign, segment, run, outcome, and idempotency state to PostgreSQL without weakening execution safety.

## Goal 4 Prompt

Implement the next unfinished chunk of "Goal 4 - Campaign Approval And Safety Gates." Ensure real campaign execution requires explicit owner approval and dry-run remains delivery-free.

## Goal 5 Prompt

Implement the next unfinished chunk of "Goal 5 - Scheduling, Throttling, And Frequency Controls." Preserve recipient safety, idempotency, and duplicate-send prevention.

## Goal 6 Prompt

Implement the next unfinished chunk of "Goal 6 - Audit Logging And Compliance Evidence." Add structured audit evidence without logging secrets or sensitive message credentials.

## Goal 7 Prompt

Implement the next unfinished chunk of "Goal 7 - API Contract Hardening." Stabilize validation and authorization contracts for consumers without changing ownership boundaries.


## Goal 8 Prompt

Implement the next unfinished chunk of "Goal 8 - Ecosystem Ownership Contract Baseline." Define cross-service ownership for tenant/app/business registry, CRM/account scope, analytics, app signals, and Marketing orchestration. Preserve Marketing as the campaign and segmentation control plane. Do not implement landing page, admin UI, CRM storage, analytics dashboards, or app-signal runtime behavior before the ownership contracts are explicit.

## Goal 9 Prompt

Implement the next unfinished chunk of "Goal 9 - Tenant/App Registry Integration." Add canonical tenant/app/brand scope to Marketing while keeping tenant truth in the registry service. Missing or invalid registry references must fail safely before campaign execution.

## Goal 10 Prompt

Implement the next unfinished chunk of "Goal 10 - Cross-Service Recipient And Consent Contract Hardening." Align auth and leads recipient contracts around tenant/app/purpose/channel consent without moving contact, identity, preference, or unsubscribe ownership into Marketing.

## Goal 11 Prompt

Implement the next unfinished chunk of "Goal 11 - Application Signal Segmentation Contracts." Add app behavior signals for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics as segmentation inputs only. Applications must not become campaign engines.

## Goal 12 Prompt

Implement the next unfinished chunk of "Goal 12 - Multi-Application Campaign Catalog." Add shared campaign catalog metadata, lifecycle stages, campaign families, and application-specific blueprints. Blueprints must not execute without explicit owner approval.

## Goal 13 Prompt

Implement the next unfinished chunk of "Goal 13 - Lifecycle Journey Engine." Add approved multi-step journey orchestration while preserving notification delegation, consent, unsubscribe, frequency caps, throttling, max-send limits, max-30 chunking, idempotency, and audit evidence.

## Goal 14 Prompt

Implement the next unfinished chunk of "Goal 14 - Landing Page And Auth Entry Points." Build the public Marketing landing page and auth-owned register/login/admin entry points without exposing service tokens or campaign execution controls.

## Goal 15 Prompt

Implement the next unfinished chunk of "Goal 15 - Admin Auth And RBAC Shell." Add browser admin access through auth-microservice session verification and server-side RBAC. The frontend must never receive `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`.

## Goal 16 Prompt

Implement the next unfinished chunk of "Goal 16 - Campaign And Segment Admin Console." Build safe browser management for Marketing-owned campaigns and segments, including dry-run and approval workflow, without bypassing backend contracts.

## Goal 17 Prompt

Implement the next unfinished chunk of "Goal 17 - Runs, Consent, Channels, And Audit Admin Views." Build visibility into runs, decisions, consent ownership, read-only channel registry metadata, and redacted audit evidence. Do not expose provider credentials, message bodies, tokens, or recipient addresses.

## Goal 18 Prompt

Implement the next unfinished chunk of "Goal 18 - Analytics And Attribution Dashboard." Emit or consume normalized campaign and conversion facts while preserving analytics/app/domain ownership boundaries.

## Goal 19 Prompt

Implement the next unfinished chunk of "Goal 19 - CRM/Account Service Integration." Integrate future CRM/account lifecycle signals as read-only segmentation inputs. Marketing must not become the CRM master database.

## Goal 20 Prompt

Implement the next unfinished chunk of "Goal 20 - Production Governance And Readiness." Add production campaign risk, approval, policy, deployment, rollback, incident, and unsubscribe escalation governance before broad real campaign operations.
