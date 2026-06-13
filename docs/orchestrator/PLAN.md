# Marketing Implementation Plan

## Execution Rule

Work one goal chunk at a time. Prefer a complete, verifiable chunk over starting multiple tracks.

## Current Program

Phase 1 core implementation is complete through Goal 7:

- Goal 1 - Intent Preservation And Contract Baseline.
- Goal 2 - External Source Integration.
- Goal 3 - Persistence And Execution State.
- Goal 4 - Campaign Approval And Safety Gates.
- Goal 5 - Scheduling, Throttling, And Frequency Controls.
- Goal 6 - Audit Logging And Compliance Evidence.
- Goal 7 - API Contract Hardening.

The next program is the expanded ecosystem marketing platform described in `docs/orchestrator/ROADMAP.md`.

## Next Goal Selection

The next valid goal is Goal 11 - Application Signal Segmentation Contracts.

Goals 8, 9, and 10 are complete. Continue Goal 11 one chunk at a time. Do not start landing page, admin UI, CRM/account runtime integration, analytics dashboards, journey automation, or app-signal runtime behavior beyond the selected Goal 11 chunk.

## Phase 2 - Ecosystem Contract And Product Baseline

Goal 8 creates ecosystem ownership contracts, CRM/account boundary, tenant/app/business registry contract, application taxonomy, analytics/event ownership boundary, and required cross-service changes.

## Phase 3 - Tenant/App And Campaign Catalog Foundation

Goal 9 adds tenant/app/brand scope and registry validation. Goal 12 adds campaign catalog metadata, lifecycle stages, campaign families, and application blueprints.

## Phase 4 - Recipient, Consent, And App Signal Hardening

Goal 10 hardens auth/leads recipient and consent contracts. Goal 11 adds application signal segmentation contracts for all target applications.

## Phase 5 - Lifecycle And CRM Signals

Goal 13 adds lifecycle journeys. Goal 19 integrates future CRM/account signals as read-only segmentation inputs.

## Phase 6 - Public Landing And Admin Console

Goal 14 builds landing/auth entry points. Goal 15 builds the admin auth/RBAC shell. Goal 16 builds campaign and segment admin management. Goal 17 builds runs, consent, channel, and audit views.

## Phase 7 - Analytics And Production Governance

Goal 18 adds analytics and attribution. Goal 20 adds production governance and readiness.

## Validation Standard

For code changes, run remotely:

```bash
npm run build
npm test
```

For frontend changes, also validate rendered desktop/mobile UI, anonymous admin rejection, token non-exposure, and responsive layouts.

For deployment, require explicit owner approval before running:

```bash
./scripts/deploy.sh
```

No real campaign execution is allowed without explicit owner approval.
