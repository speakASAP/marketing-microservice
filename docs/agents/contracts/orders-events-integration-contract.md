# Orders Events Integration Contract

## Intent

Marketing may consume Orders lifecycle events as read-only order signals for campaign attribution evidence and aggregate statistics. Orders remains the source of truth for order records, order items, order status, payment/shipment boundaries, and order lifecycle event publication.

Marketing must not copy raw order truth, customer/contact data, payment data, addresses, tracking data, provider credentials, or campaign execution authority from Orders events.

## Verified Orders Producer Contract

Live source verification on 2026-07-01 found:

- Producer repository: `/home/ssf/Documents/Github/orders-microservice`.
- RabbitMQ exchange: `orders.events`.
- Current created routing key: `orders.order.created.v1`.
- Current status-change routing key: `orders.order.updated.v1`.
- Approved Marketing status-change binding: `orders.order.updated.v1`.
- Unapproved alias `orders.order.status_changed.v1`: not used by Marketing unless Orders adds it in a future producer contract.
- Fixture verifier in Orders: `npm run verify:event-contracts`.
- Current approved campaign join key on created events: optional `payload.leadAttribution.campaignId` on `orders.order.created.v1`.

Allowed payload fields in the verified Orders contract are bounded to order references and safe lifecycle metadata. Events must not include customer objects, customer addresses, billing addresses, payment method details, provider secrets, bearer tokens, JWTs, passwords, raw credentials, tracking numbers, tracking URLs, operator email addresses, or approver display identities.

## Marketing Consumer Core And Runtime Adapter

Marketing now has a transport-independent consumer core in `src/order-lifecycle-events.ts` and a gated AMQP adapter in `src/orders-events-consumer.ts`.

It supports:

- Validating `orders.order.created.v1` and the currently verified status-change event, `orders.order.updated.v1`.
- Rejecting unapproved `orders.order.status_changed.v1` messages while binding to `orders.order.updated.v1`.
- Idempotency by `eventId`.
- Aggregate order signal statistics by event type, channel, and status.
- Order references as `orders:order:<orderId>`.
- Campaign-level attribution when `orders.order.created.v1` includes explicit `payload.leadAttribution.campaignId` from an approved channel caller.
- Status-update attribution by joining later `orders.order.updated.v1` events to the previously seen attributed `orderId`.
- Run/correlation attribution remains blocked until Orders or an approved source emits explicit `runId` or `correlationId` metadata.

The adapter:

- Starts only when `ORDERS_EVENTS_CONSUMER_ENABLED=true`.
- Uses `RABBITMQ_URL` without logging the value.
- Asserts durable exchange `orders.events`.
- Asserts durable Marketing queue `marketing.orders.lifecycle`.
- Binds `orders.order.created.v1` and `orders.order.updated.v1`.
- Uses dead-letter exchange `marketing.orders.lifecycle.dlx` with `ORDERS_EVENTS_REQUEUE_ON_ERROR=false` by default.
- Acknowledges valid accepted, duplicate, and malformed contract-rejected messages after recording sanitized audit evidence.
- Nacks processing/storage errors without requeue by default so RabbitMQ can dead-letter them.

## Runtime Blockers

- `[MISSING: Orders event payload runId/correlationId or approved attribution join contract for run-level attribution]`.

## Runtime Configuration

Keys:

- `RABBITMQ_URL`: broker URL supplied by runtime/secret configuration; value must not be logged. Kubernetes maps this name from the existing Vault-backed `secret/prod/runlayer` `RABBITMQ_URL` property.
- `ORDERS_EVENTS_CONSUMER_ENABLED`: `true` to start the consumer. Production deployment config is enabled after Vault-backed `RABBITMQ_URL` mapping is present.
- `ORDERS_EVENTS_EXCHANGE`: default `orders.events`.
- `ORDERS_EVENTS_QUEUE`: default `marketing.orders.lifecycle`.
- `ORDERS_EVENTS_ROUTING_KEYS`: default `orders.order.created.v1,orders.order.updated.v1`.
- `ORDERS_EVENTS_DEAD_LETTER_EXCHANGE`: default `marketing.orders.lifecycle.dlx`.
- `ORDERS_EVENTS_PREFETCH`: default `10`.
- `ORDERS_EVENTS_REQUEUE_ON_ERROR`: default `false`.

## Campaign Attribution Join Contract

Marketing accepts exactly one campaign-level Orders join key today:

```json
{
  "type": "orders.order.created.v1",
  "payload": {
    "orderId": "order-1001",
    "channel": "flipflop",
    "leadAttribution": {
      "campaignId": "campaign-1001"
    }
  }
}
```

Rules:

- `payload.leadAttribution.campaignId` is optional and must be supplied explicitly by an approved Orders create caller; Marketing must not infer it from customer/contact/address/payment data.
- Marketing uses only `campaignId` from `leadAttribution` for campaign-level attribution. `leadId` and `source`, when present for Leads, remain source-owned and are not persisted by Marketing in this Orders lifecycle table.
- Later status events are attributed to the same campaign only through the already persisted `orderId -> campaignId` association from the created event.
- The event must not approve, schedule, execute, dry-run, or deliver any campaign.
- `runId` and `correlationId` are still unavailable in the verified Orders event contract and remain `[MISSING: ...]` for run-level attribution.

## Persistence And Replay Contract

Migration `0011_order_lifecycle_event_consumer.sql` adds `marketing_order_lifecycle_events` with `event_id` as the primary key. Migration `0012_order_lifecycle_campaign_attribution.sql` adds nullable `campaign_id`. This table stores only bounded lifecycle signal fields: event ID, event type/version, order ID, occurred/received timestamps, channel, status, previous status, and optional campaign ID.

Replay/backfill uses the same queue or message content path and deduplicates by `eventId`. Replayed duplicates are acknowledged and logged as duplicates without changing statistics.

Malformed contract-rejected events are not persisted because they are not valid Orders lifecycle signals.

## Ownership Boundary

- Orders owns canonical order truth and event publication.
- Marketing owns campaign definitions, segment definitions, execution runs, delivery decisions, and Marketing-owned aggregate attribution evidence.
- Notifications remains the only outbound provider execution owner.
- Auth/leads remain contact, preference, consent, and unsubscribe owners.
- No Orders event may approve, schedule, execute, or deliver a campaign.

## Validation

Focused validation:

```bash
npx tsx --test --test-concurrency=1 test/order-lifecycle-events.test.ts
```

Full repository validation:

```bash
npm run build
npm test
git diff --check
```
