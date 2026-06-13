# Ecosystem Ownership Contract

## Purpose

This contract defines ownership boundaries for the expanded Statex marketing ecosystem. It exists to prevent Marketing from becoming a direct delivery service, contact database, CRM master database, tenant registry, analytics warehouse, order owner, catalog owner, or application event owner.

## Preserved Marketing Role

Marketing-microservice is the campaign and segmentation control plane. It owns:

- Campaign definitions and campaign catalog metadata.
- Segment definitions, segment snapshots, and segment decision logic.
- Dry-run, approval, scheduling, execution-run, suppression, throttling, and frequency-cap state.
- Recipient delivery decisions before notification delegation.
- Campaign outcome records, attribution references, and sanitized audit evidence.
- Lifecycle journey definitions and step decisions once those goals are implemented.

Marketing must not own:

- Registered-user identity, contact data, preference, consent, or unsubscribe truth.
- Lead identity, contact data, preference, consent, or unsubscribe truth.
- Provider credentials, outbound provider routing, final send execution, or channel registry state.
- Tenant, business, application, brand, sender identity, locale, or timezone truth.
- CRM/account master data such as companies, opportunities, pipeline state, account health, sales notes, or customer-success ownership.
- Raw app/domain event truth, order truth, product truth, listing truth, reservation truth, learning progress truth, workflow truth, or report usage truth.

## Ownership Matrix

| Domain | Source of truth | Marketing usage | Guardrail |
| --- | --- | --- | --- |
| Registered users | `auth-microservice` | Resolve registered-user recipients and consent | Do not store contact or consent truth in Marketing. |
| Leads | `leads-microservice` | Resolve lead recipients and consent | Do not target leads without source-owned explicit consent. |
| Delivery providers | `notifications-microservice` | Delegate notification requests | Never call email, Telegram, WhatsApp, or other provider APIs directly. |
| Channel registry | `notifications-microservice` | Select optional `channelKey` and read registry metadata | Do not store provider credentials or registry truth. |
| Campaigns and segments | `marketing-microservice` | Own definitions, decisions, runs, and audit | Do not move this responsibility into application services. |
| Tenant/app/business registry | Existing or future registry service | Validate `tenantId`, `appId`, `brandId`, locale, timezone, and sender identity references | Store IDs and decision evidence, not registry truth. |
| Orders and commerce signals | `orders-microservice` and app/domain services | Read order/purchase/reservation/listing signals for segmentation | Do not become order or commerce source of truth. |
| Product/catalog signals | `catalog-microservice` or app product services | Read product/SKU/category metadata for segmentation | Do not become product source of truth. |
| Application behavior signals | Each app or shared event pipeline | Read behavior/lifecycle signals for segmentation | Apps emit facts; Marketing defines campaigns and segments. |
| CRM/account lifecycle | Future CRM/account service | Read account, opportunity, health, lifecycle, owner, and onboarding signals | Marketing must not become CRM master database. |
| Analytics and attribution | Analytics/event pipeline or customer-insights service | Emit campaign facts and consume attribution read models | Marketing campaign facts are not complete customer truth. |
| Logs/audit | `logging-microservice` plus Marketing persisted outcomes | Forward sanitized audit evidence | Do not log secrets, message bodies, provider credentials, or raw recipient addresses. |

## Required Cross-Service Contract Changes

### Auth Microservice

Auth must expose or confirm APIs for registered-user recipient resolution by tenant/app/purpose/channel. Required fields include stable user ID, tenant/app scope, preferred channel, fallback channels, reachable addresses, consent state by purpose/channel, unsubscribe state, locale/timezone where known, and safe pagination.

Auth remains the owner of registered-user contact data, preferences, and consent. Marketing may cache execution evidence, but not source truth.

### Leads Microservice

Leads must expose or confirm APIs for lead recipient resolution by tenant/app/purpose/channel. Required fields include stable lead ID, lead lifecycle/qualification fields, preferred channel, fallback channels, reachable addresses, explicit marketing consent, unsubscribe state, locale/timezone where known, and lead-to-user conversion references where applicable.

Leads remains the owner of non-registered lead identity, contact data, preferences, and consent.

### Notifications Microservice

Notifications must own channel registry, provider credentials, provider routing, send execution, provider callbacks, and delivery result normalization. Marketing may send `channel`, optional `channelKey`, `purpose`, `tenantId`, `appId`, `brandId`, and correlation metadata once later contracts add those fields.

Notifications must not require Marketing to store provider credentials.

### Domain And Application Services

Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, Statics, orders, catalog, and other services may expose read-only segmentation signals or publish events. They must not own campaign execution, recipient consent enforcement, frequency caps, or notification delivery decisions.

### Tenant/App/Business Registry

A registry service must own canonical tenant, business, app, brand, environment, sender identity, allowed channel, locale, timezone, and policy references. Marketing stores stable IDs and validates them but does not become the registry.

### Analytics/Event Pipeline

Analytics must own cross-app attribution, funnels, cohorts, LTV, and customer-insights read models. Marketing emits campaign decision facts and consumes read models when needed.

### Future CRM/Account Service

A CRM/account service should own accounts, companies, opportunities, pipeline stages, account owner, account health, onboarding status, lifecycle stage, customer-success notes, and sales notes. Marketing reads these as segmentation signals only.

## Enforcement Rules

- No real campaign execution without explicit owner approval.
- No notification provider calls from Marketing.
- No marketing-purpose recipient without explicit source-owned consent.
- Unsubscribe and frequency-cap checks stay before notification delegation.
- Outbound notification chunks stay at or below 30 recipients.
- Source-service failures must skip or fail safely without direct delivery.
- New app/domain integrations must be signal sources, not campaign engines.
