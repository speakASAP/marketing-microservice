# Marketing Ecosystem Roadmap

## Purpose

This roadmap defines the next major program for `marketing-microservice` after Phase 1 core implementation. Marketing must become the shared Statex campaign and segmentation control plane for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.

The goal is to help business users market Statex applications and services without duplicating delivery logic, contact ownership, consent ownership, CRM master data, or application-specific business ownership.

## Preserved Intent

Marketing owns campaigns, segments, journeys, approvals, dry-runs, scheduled runs, delivery decisions, throttling, frequency caps, suppression decisions, attribution references, and campaign audit state.

Marketing does not own registered-user identity, lead identity, contact data, consent truth, provider credentials, outbound provider execution, channel registry state, order truth, catalog truth, tenant truth, CRM/account master data, or application event truth.

All real outbound delivery remains delegated to `notifications-microservice`. Real campaigns still require explicit owner approval and recipient consent before delivery.

## Sub-Agent Analysis Summary

This roadmap was created after three parallel read-only sub-agent analyses covering ecosystem ownership, product/CRM/channel roadmap, and landing/admin implementation sequencing. The agents converged on the same boundary: Marketing should provide campaign orchestration and CRM-like engagement workflows, but it should not become the CRM/customer master database.

## CRM Decision

A full CRM should not be implemented inside `marketing-microservice`.

| Capability | Owner | Marketing relationship |
| --- | --- | --- |
| Registered users, identity, contact data, registered-user consent | `auth-microservice` | Read recipient/contact/consent state through contracts. |
| Non-registered leads, lead contact data, lead consent | `leads-microservice` | Read lead recipient/contact/consent state through contracts. |
| Campaigns, segments, journeys, approvals, runs, frequency caps, suppression, campaign audit | `marketing-microservice` | Own decisioning and orchestration. |
| Channel registry, provider credentials, provider routing, send execution | `notifications-microservice` | Delegate delivery requests only. |
| Orders, reservations, listings, purchases, app behavior | Domain/app services | Read segmentation signals only. |
| Product truth and SKU metadata | `catalog-microservice` or app product services | Read product signals only. |
| Tenant, business, app, brand, sender identity, locale/timezone | Existing or new tenant/app/business registry | Store IDs and validate references only. |
| Accounts, companies, opportunities, account health, customer-success notes | Future CRM/account service | Consume lifecycle signals only. |
| Attribution, funnels, LTV, cohorts, cross-app analytics | Analytics/event pipeline or customer-insights service | Emit marketing facts and consume read models. |

A CRM console may compose Marketing, Auth, Leads, Analytics, and a future CRM/account service, but data ownership must remain separated.

## Application Marketing Model

| Application | Primary marketing motions | Example segmentation signals |
| --- | --- | --- |
| Flipflop | Acquisition, abandoned intent, purchase follow-up, winback, cross-sell | Product views, checkout events, purchases, category interest. |
| SpeakASap | Course onboarding, lesson progress, trial conversion, reactivation | Registration, language interest, lesson progress, inactivity, subscription state. |
| Marathon | Event signup, training activation, reminders, retention | Registration, training milestones, event participation, inactivity. |
| Bazos | Listing activation, seller/buyer reactivation, category alerts | Listing created, listing expired, search/category interest, response events. |
| Rent-A-Box | Reservation onboarding, storage lifecycle, renewal, upsell | Reservation status, move-in date, renewal date, capacity/plan state. |
| RunLayer | B2B onboarding, workflow activation, feature adoption, renewal | Tenant created, first workflow, workflow run volume, failed setup, usage tier. |
| Shop Assistant | Cart recovery, product recommendations, merchant onboarding, retention | Cart events, product intent, merchant setup, recommendation interactions. |
| Statics | Report adoption, dashboard activation, account expansion, renewal | Report created, dashboard viewed, inactive workspace, plan usage. |

Applications should expose signals or events. They should not implement local campaign engines.

## Channel Strategy

Current primary channels remain email, Telegram, and WhatsApp. Marketing should add channel strategy metadata and admin controls for tenant/app/brand scoped `channelKey`, preferred channel, fallback order, purpose-specific consent, quiet hours by locale/timezone, per-channel frequency caps, template references, locale selection, and dry-run channel decision previews.

Future channels such as in-app and push can be added only after `notifications-microservice` owns the provider/channel implementation and registry behavior.

## Landing Page Scope

The public landing page at `/` should explain multi-application campaign orchestration, segmentation across auth/leads/orders/catalog/CRM/app signals, consent-first execution, email/Telegram/WhatsApp delivery through notifications, approval-gated real execution, dry-run previews, audit-grade evidence, analytics roadmap, and admin dashboard capabilities.

Required actions: Register, Login, and Admin. Register/login must delegate to auth-microservice with return URLs. Admin must route to `/admin` and require auth/RBAC.

## Admin Dashboard Scope

Admin access must be available only to authenticated users with roles granted by `auth-microservice`. Recommended roles are `marketing_viewer`, `marketing_operator`, `marketing_admin`, and future `marketing_owner`.

The browser must never receive `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`. Admin APIs should verify auth sessions server-side and call Marketing functions through RBAC-aware handlers.

Core admin views: overview, campaigns, segments, runs, journeys, applications, channels, consent, audit, analytics, and settings. These views expose Marketing-owned state, read-only external ownership metadata, and safe actions such as dry-run and approval. They must not expose provider credentials, message secrets, service tokens, or direct provider delivery controls.

## Implementation Phases

1. Phase 2 - Ecosystem Contract And Product Baseline: ownership docs, CRM boundary, app taxonomy, registry contract, consent vocabulary, signal taxonomy.
2. Phase 3 - Tenant/App And Campaign Catalog Foundation: tenant/app metadata, registry validation, catalog APIs, lifecycle stages, campaign blueprints.
3. Phase 4 - Recipient, Consent, And App Signal Hardening: tenant/app/purpose/channel recipient contracts and app signal segmentation.
4. Phase 5 - Lifecycle And CRM Signals: journey definitions, triggers, suppressions, approval gates, CRM/account read-only signal integration.
5. Phase 6 - Public Landing And Admin Console: landing page, auth entry points, admin RBAC shell, campaigns, segments, runs, consent, channels, audit.
6. Phase 7 - Analytics And Production Governance: event emission, attribution dashboards, campaign risk classification, quiet hours, deployment and rollback playbooks.

## Detailed Goal Backlog

- Goal 8 - Ecosystem Ownership Contract Baseline: document tenant/app/business registry ownership, CRM/account boundaries, analytics ownership, app signal responsibilities, and cross-service contract changes.
- Goal 9 - Tenant/App Registry Integration: add canonical tenant/app/brand scope to campaigns and segments while keeping tenant truth outside Marketing.
- Goal 10 - Cross-Service Recipient And Consent Contract Hardening: align auth/leads recipient contracts around tenant/app/purpose/channel consent, unsubscribe, and lead-to-user conversion.
- Goal 11 - Application Signal Segmentation Contracts: define and implement app signal segmentation for Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, and Statics.
- Goal 12 - Multi-Application Campaign Catalog: add campaign families, lifecycle stages, blueprints, catalog APIs, filters, migration, and tests.
- Goal 13 - Lifecycle Journey Engine: add approved multi-step journeys with triggers, exits, suppressions, scheduler/idempotency integration, dry-run previews, and audit evidence.
- Goal 14 - Landing Page And Auth Entry Points: build public landing page, register/login/admin buttons, auth-owned login/register redirects, and static asset serving.
- Goal 15 - Admin Auth And RBAC Shell: add auth session verification, viewer/operator/admin/owner roles, `/admin/api/session`, protected admin routes, tests.
- Goal 16 - Campaign And Segment Admin Console: build campaign and segment management views with dry-run, approval, schedule, pause/archive controls.
- Goal 17 - Runs, Consent, Channels, And Audit Admin Views: build run/outcome search, consent ownership views, read-only channel registry view, redacted audit, correlation search.
- Goal 18 - Analytics And Attribution Dashboard: emit normalized marketing events, define conversion/correlation contracts, add attribution metadata and dashboard summaries.
- Goal 19 - CRM/Account Service Integration: integrate future CRM/account lifecycle signals as read-only segmentation inputs without making Marketing the CRM master database.
- Goal 20 - Production Governance And Readiness: add risk classification, high-risk approvals, quiet-hour and tenant/app policies, deployment, rollback, incident, and unsubscribe escalation playbooks.

## Validation Strategy

Every implementation goal must run or document:

```bash
npm run build
npm test
```

Frontend goals must also verify desktop/mobile rendering, anonymous admin rejection, token non-exposure, and responsive layouts. Deployment requires explicit owner approval before `./scripts/deploy.sh`. Real campaign execution requires explicit owner approval.
