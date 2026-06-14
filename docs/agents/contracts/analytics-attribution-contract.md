# Analytics And Attribution Contract

## Purpose

This contract defines how Marketing participates in analytics and attribution without becoming the owner of all customer, app, revenue, or behavior truth.

## Ownership

Marketing owns campaign facts:

- Campaign created/updated/approved/revoked.
- Segment selected and dry-run resolved.
- Run started/completed/failed.
- Recipient sent/skipped/failed decision.
- Channel requested/effective decision.
- Suppression, consent, unsubscribe, frequency-cap, approval, throttle, idempotency, and notification delegation evidence.
- Campaign/run/correlation IDs needed for traceability.

Notifications owns provider delivery facts:

- Provider accepted/rejected.
- Provider delivery, bounce, complaint, unsubscribe callback, and provider-specific error state.
- Channel registry and provider route metadata.

Applications and domain services own behavior facts:

- Product views, purchases, orders, reservations, listings, lessons, workflows, reports, cart events, and application usage.

Analytics or customer-insights services own cross-service read models:

- Attribution, funnels, cohorts, LTV, conversion rates, revenue impact, app/tenant performance, and customer-insights dashboards.

## Common Event Envelope

Future event emission should use a stable envelope:

```json
{
  "eventId": "uuid",
  "eventType": "marketing.campaign.run.completed",
  "sourceService": "marketing-microservice",
  "occurredAt": "2026-06-13T00:00:00.000Z",
  "tenantId": "tenant_123",
  "appId": "runlayer",
  "brandId": "statex",
  "campaignId": "campaign_123",
  "runId": "run_123",
  "recipientRef": "auth:user:123",
  "correlationId": "corr_123",
  "subjectRef": "auth:user:123",
  "metadata": {}
}
```

## Attribution Rules

- Marketing may store campaign attribution references and UTM-like metadata.
- Marketing may emit campaign facts for downstream attribution.
- Marketing must not infer conversion or revenue truth unless it comes from the owning app/domain/analytics source.
- Attribution dashboards should distinguish sent, skipped, failed, delivered, converted, and revenue/value attributed.
- Recipient identifiers must use stable references and avoid exposing raw contact addresses in analytics events.

## Goal 18 Read-Only Analytics Aggregation

Marketing may build read-only summary models from Marketing-owned campaign and run state. The initial safe aggregation surface is code-only and may group existing records by:

- Tenant, app, brand, business, product line, lifecycle scope, environment, campaign, segment, lifecycle stage, campaign family, channel, decision reason, and time range.
- Outcome statuses already stored by Marketing: `sent`, `skipped`, `failed`, `would_send`, and `queued`.
- Campaign/run identifiers, idempotency keys, correlation IDs, requested/effective channels, source-owner recipient references, and sanitized decision reasons.

The aggregation surface must not store or display raw recipient addresses, message subjects/bodies, provider credentials, service tokens, authorization headers, notification-provider payloads, source-owned contact/preference truth, order truth, catalog product truth, CRM master data, or raw application event truth.

When no external attribution facts are supplied, delivered, converted, and attributed value fields must remain explicitly unavailable with `external_analytics_required` evidence instead of being inferred from Marketing sends.

## External Attribution Fact Contract

Delivery, conversion, and value facts remain externally owned. A future dashboard or analytics-service integration may join externally supplied facts to Marketing summaries only by stable references:

- `sourceService`
- `factType`: `delivered`, `converted`, or `attributed_value`
- `occurredAt`
- `campaignId`
- Optional `runId`
- Optional `correlationId`
- Optional `count`
- Optional `value`
- Optional `currency`

`delivered` facts should come from notifications-microservice or another approved delivery-read source. `converted` and `attributed_value` facts should come from an analytics/customer-insights service or the source-owning app/domain through an approved analytics contract. Marketing may aggregate these supplied facts for display, but the source service remains the truth owner.

## Normalized Marketing Facts

Read-only normalized facts emitted or exported from Marketing must be sanitized. Supported initial fact categories are:

- `marketing.campaign.run.recorded`
- `marketing.recipient.outcome.recorded`

These facts may include campaign/run IDs, idempotency key, tenant/app/brand scope, segment ID, recipient source owner, stable recipient reference, correlation ID, requested/effective channel, status, decision reason, lifecycle stage, campaign family, duration, dry-run flag, total recipient count, total sent count, and approval status evidence. They must not include raw addresses, message content, provider credentials, tokens, or notification-provider payloads.

## Dashboard UI Gate

The protected analytics dashboard UI remains dependency-gated until Goal 15 admin auth/RBAC is conclusively reconciled and shared Goal 16/17 admin navigation is stable. Until then, Goal 18 implementation is limited to contracts, normalized fact helpers, read-only aggregation helpers, and tests that do not expose browser admin data.

## Guardrails

- Do not log or emit secrets, provider credentials, raw authorization headers, message bodies, or raw recipient addresses.
- Do not weaken consent, unsubscribe, frequency caps, approval, throttling, idempotency, or max-30 delivery chunking for analytics.
- Analytics read-model outages must not trigger direct delivery or campaign re-execution.
