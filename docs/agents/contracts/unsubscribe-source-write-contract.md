# Source-Owned Unsubscribe Write Contract

## Owner

Auth-microservice owns registered-user unsubscribe, consent, and preference writes.

Leads-microservice owns lead unsubscribe, consent, and preference writes.

Marketing-microservice may accept unsubscribe intake and forward it to the source owner. Marketing must not become the durable unsubscribe, consent, or preference store.

## Marketing Intake Endpoint

Marketing exposes:

```http
POST /preferences/unsubscribe
```

Accepted request fields:

- `owner`: required, `auth` or `leads`.
- `recipientId`: required source-owned registered-user ID or lead ID.
- `channel`: optional, `email`, `telegram`, or `whatsapp`.
- `purpose`: optional, `marketing`, `retention`, or `transactional-not-marketing`; defaults to `marketing`.
- `tenantId`, `appId`, `brandId`: optional scope evidence from the unsubscribe link or UI.
- `requestId`: optional caller correlation ID.
- `reason`: optional source-readable reason; defaults to `marketing_unsubscribe_intake` when forwarded.

Marketing validates the request, logs sanitized audit evidence, and returns `202 Accepted` whether the source write was forwarded immediately or left pending for source handling. The response includes `writeOwner`, `sourceWriteStatus`, optional `sourceStatus`, and optional `sourceWriteReason`.

## Source Write-Through Endpoints

Auth should expose or confirm:

```http
POST /auth/marketing/preferences/unsubscribe
```

Leads should expose or confirm:

```http
POST /leads/marketing/preferences/unsubscribe
```

Marketing may configure deployed paths with `AUTH_UNSUBSCRIBE_PATH` and `LEADS_UNSUBSCRIBE_PATH`. The source request body is:

```json
{
  "recipientId": "source-owned-id",
  "channel": "email",
  "purpose": "marketing",
  "tenantId": "statex",
  "appId": "flipflop",
  "brandId": "statex-main",
  "requestId": "caller-correlation-id",
  "reason": "marketing_unsubscribe_intake",
  "requestedAt": "2026-06-13T00:00:00.000Z",
  "source": "marketing-microservice"
}
```

Source services should treat this as an unsubscribe/preference mutation in their own data model and return any 2xx status once accepted. Source services remain responsible for durable storage, policy interpretation, and preference read behavior.

## Safe Failure Behavior

If the source service URL is not configured, unavailable, or rejects the write, Marketing returns `202 Accepted` with `sourceWriteStatus: source_write_pending` and a sanitized reason. Marketing must not persist a replacement unsubscribe truth record. Operational systems must ensure the source owner honors unsubscribe requests within 24 hours.

Execution remains protected by source-owned unsubscribe fields returned from auth/leads recipient resolution. Once the source-owned unsubscribe state is visible to Marketing, the recipient is skipped before notification delegation.

## Forbidden Behavior

Marketing must not:

- Store durable unsubscribe truth as a replacement for auth/leads.
- Infer consent from a successful unsubscribe intake.
- Re-subscribe a recipient or weaken source consent policy.
- Send directly to email, Telegram, WhatsApp, or provider APIs.
- Bypass owner approval, consent checks, frequency caps, throttling, idempotency, max-send limits, or max-30 notification chunking.
