# Leads Recipient And Consent Contract

## Owner

Leads-microservice owns lead identity, contact data, preferred channels, fallback channels, lifecycle state, qualification fields, consent, unsubscribe state, and lead-to-user conversion references.

Marketing-microservice reads this data for campaign recipient resolution and enforcement. Marketing stores campaign execution evidence only; it must not copy leads contact, preference, consent, unsubscribe, lifecycle, or conversion truth into Marketing-owned master records.

## Recipient Resolution Endpoint

Leads must expose or confirm a service-to-service recipient resolution endpoint for Marketing:

```http
GET /leads/marketing/recipients
```

The deployed path may be configured by Marketing with `LEADS_SEGMENT_PATH`, but the request and response semantics must match this contract.

## Required Query Fields

Marketing sends these fields on every leads recipient request:

- `tenantId`: canonical tenant/workspace/customer identifier from the campaign scope.
- `appId`: canonical application identifier from the campaign scope.
- `brandId`: canonical brand/sender identity reference from the campaign scope.
- `purpose`: campaign purpose, one of `marketing`, `retention`, or `transactional-not-marketing`.
- `channel`: campaign primary channel, one of `email`, `telegram`, or `whatsapp`.
- `limit`: maximum page size requested by Marketing.

Optional query fields:

- `fallbackChannels`: comma-separated campaign fallback channels.
- `businessId`, `environment`, `productLine`, `lifecycleScope`: campaign or segment scope filters when present.
- Lead lifecycle, qualification, source, campaign, form, tag, locale, attribution, or app-specific segment filters.
- Pagination cursor fields when the leads endpoint returns `nextCursor`.

Leads must treat `tenantId`, `appId`, `purpose`, and `channel` as consent scope selectors, not just metadata.

## Response Shape

Leads may return recipients in `leads`, `items`, `data`, `results`, or `recipients`. Each item must include:

- Stable lead ID: `id` or `leadId`.
- Reachable address for the requested or selected channel, such as `email`, `primaryEmail`, `phone`, `phoneNumber`, `primaryPhone`, or `contactMethods` entries.
- `preferredChannel`.
- `fallbackChannels`.
- Source-owned consent evidence for the requested tenant/app/purpose/channel.
- Source-owned unsubscribe state.

Recommended item shape:

```json
{
  "id": "lead_123",
  "tenantId": "statex",
  "appId": "flipflop",
  "contactMethods": [
    { "type": "email", "value": "lead@example.com", "isPrimary": true },
    { "type": "whatsapp", "value": "+420000000000", "isPrimary": false }
  ],
  "preferredChannel": "email",
  "fallbackChannels": ["whatsapp"],
  "marketingConsents": {
    "marketing": {
      "email": true,
      "whatsapp": false
    }
  },
  "unsubscribed": false,
  "convertedAuthUserId": null,
  "updatedAt": "2026-06-13T00:00:00.000Z"
}
```

Leads may also return a normalized `consentByPurposeChannel` object:

```json
{
  "consentByPurposeChannel": {
    "marketing": {
      "email": { "granted": true, "unsubscribed": false },
      "telegram": { "granted": false, "unsubscribed": false }
    }
  }
}
```

## Consent Semantics

For marketing-purpose campaigns, Marketing requires explicit source-owned lead consent before delivery. A lead is eligible only when:

- Leads returns consent granted for the requested tenant/app/purpose/channel, or for a documented wildcard purpose/channel accepted by leads.
- Leads does not return any unsubscribe or transactional-only state for that lead.
- Marketing frequency caps, throttles, approval, idempotency, and max-send guardrails also pass.

If channel-specific consent is returned, Marketing must skip a lead when the effective delivery channel is explicitly denied, even if broader marketing consent is true.

## Conversion Boundary

Lead-to-user conversion references such as `convertedAuthUserId`, `authUserId`, or identity-link metadata remain source-owned by leads and auth. Marketing may use those references as execution evidence and run-level deduplication inputs, but conversion truth and contact records do not move into Marketing. The detailed behavior is defined in `docs/agents/contracts/lead-identity-linking-contract.md`.


## Unsubscribe Write Ownership

Lead unsubscribe writes are source-owned by leads. Marketing public unsubscribe intake may forward requests to leads using `docs/agents/contracts/unsubscribe-source-write-contract.md`, but Marketing must not store durable lead unsubscribe truth. Leads must expose unsubscribe state back through recipient resolution so Marketing can skip unsubscribed leads before notification delegation.

## Pagination And Limits

Marketing requests `LEADS_SEGMENT_LIMIT` or `30` by default. Leads should return no more than the requested page size and may include `nextCursor` for future cursor-based pagination. Until cursor iteration is implemented in Marketing, leads should return a safely bounded first page or expose segment-specific filters that keep responses within operational limits.

## Failure Behavior

If leads is unavailable, returns invalid data, or cannot evaluate tenant/app/purpose/channel consent, Marketing must fail or skip safely before notification delegation. Marketing must record source failure evidence and must not send directly or infer consent from stale local contact data.

## Ownership Boundaries

- Leads remains the source of truth for lead identity, contact data, preferences, consent, unsubscribe state, lifecycle state, qualification, and conversion references.
- Marketing may cache run/outcome evidence but not leads master data.
- Auth remains the source of truth for registered-user records after conversion.
- Notifications remains the only outbound provider execution service.
- Tenant/app/business registry remains the source of canonical tenant/app/brand references.
