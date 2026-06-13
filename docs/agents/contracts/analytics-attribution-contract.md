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

## Guardrails

- Do not log or emit secrets, provider credentials, raw authorization headers, message bodies, or raw recipient addresses.
- Do not weaken consent, unsubscribe, frequency caps, approval, throttling, idempotency, or max-30 delivery chunking for analytics.
- Analytics read-model outages must not trigger direct delivery or campaign re-execution.
