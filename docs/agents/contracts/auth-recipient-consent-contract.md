# Auth Recipient And Consent Contract

## Owner

Auth-microservice owns registered-user identity, contact data, preferred channels, fallback channels, consent, and unsubscribe state.

Marketing-microservice reads this data for campaign recipient resolution and enforcement. Marketing stores campaign execution evidence only; it must not copy auth contact, preference, consent, or unsubscribe truth into Marketing-owned master records.

## Recipient Resolution Endpoint

Auth must expose or confirm a service-to-service recipient resolution endpoint for Marketing:

```http
GET /auth/marketing/recipients
```

The deployed path may be configured by Marketing with `AUTH_USERS_SEGMENT_PATH`, but the request and response semantics must match this contract.

## Required Query Fields

Marketing sends these fields on every auth recipient request:

- `tenantId`: canonical tenant/workspace/customer identifier from the campaign scope.
- `appId`: canonical application identifier from the campaign scope.
- `brandId`: canonical brand/sender identity reference from the campaign scope.
- `purpose`: campaign purpose, one of `marketing`, `retention`, or `transactional-not-marketing`.
- `channel`: campaign primary channel, one of `email`, `telegram`, or `whatsapp`.
- `limit`: maximum page size requested by Marketing.

Optional query fields:

- `fallbackChannels`: comma-separated campaign fallback channels.
- `businessId`, `environment`, `productLine`, `lifecycleScope`: campaign or segment scope filters when present.
- Segment rule filters such as cohort, lifecycle, role, locale, tag, or source-specific predicates.
- Pagination cursor fields when the auth endpoint returns `nextCursor`.

Auth must treat `tenantId`, `appId`, `purpose`, and `channel` as consent scope selectors, not just metadata.

## Response Shape

Auth may return recipients in `users`, `items`, `data`, `results`, or `recipients`. Each item must include:

- Stable registered-user ID: `id`, `userId`, or `authUserId`.
- Reachable address for the requested or selected channel, such as `email`, `primaryEmail`, `phone`, `phoneNumber`, or `primaryPhone`.
- `preferredChannel`.
- `fallbackChannels`.
- Source-owned consent evidence for the requested tenant/app/purpose/channel.
- Source-owned unsubscribe state.

Recommended item shape:

```json
{
  "id": "user_123",
  "tenantId": "statex",
  "appId": "flipflop",
  "email": "user@example.com",
  "phone": "+420000000000",
  "preferredChannel": "email",
  "fallbackChannels": ["whatsapp"],
  "marketingConsents": {
    "marketing": {
      "email": true,
      "whatsapp": false
    }
  },
  "unsubscribed": false,
  "updatedAt": "2026-06-13T00:00:00.000Z"
}
```

Auth may also return a normalized `consentByPurposeChannel` object:

```json
{
  "consentByPurposeChannel": {
    "marketing": {
      "email": { "granted": true, "unsubscribed": false },
      "whatsapp": { "granted": false, "unsubscribed": false }
    }
  }
}
```

## Consent Semantics

For marketing-purpose campaigns, Marketing requires explicit source-owned consent before delivery. A recipient is eligible only when:

- Auth returns consent granted for the requested tenant/app/purpose/channel, or for a documented wildcard purpose/channel accepted by auth.
- Auth does not return any unsubscribe or transactional-only state for that recipient.
- Marketing frequency caps, throttles, approval, idempotency, and max-send guardrails also pass.

If channel-specific consent is returned, Marketing must skip a recipient when the effective delivery channel is explicitly denied, even if broader marketing consent is true.


## Unsubscribe Write Ownership

Registered-user unsubscribe writes are source-owned by auth. Marketing public unsubscribe intake may forward requests to auth using `docs/agents/contracts/unsubscribe-source-write-contract.md`, but Marketing must not store durable registered-user unsubscribe truth. Auth must expose unsubscribe state back through recipient resolution so Marketing can skip unsubscribed registered users before notification delegation.

## Pagination And Limits

Marketing requests `AUTH_USERS_SEGMENT_LIMIT` or `100` by default. Auth should return no more than the requested page size and may include `nextCursor` for future cursor-based pagination. Until cursor iteration is implemented in Marketing, auth should return a safely bounded first page or expose segment-specific filters that keep responses within operational limits.

## Failure Behavior

If auth is unavailable, returns invalid data, or cannot evaluate tenant/app/purpose/channel consent, Marketing must fail or skip safely before notification delegation. Marketing must record source failure evidence and must not send directly or infer consent from stale local contact data.

## Ownership Boundaries

- Auth remains the source of truth for registered-user identity, contact data, preferences, consent, and unsubscribe state.
- Marketing may cache run/outcome evidence but not auth master data.
- Notifications remains the only outbound provider execution service.
- Tenant/app/business registry remains the source of canonical tenant/app/brand references.
