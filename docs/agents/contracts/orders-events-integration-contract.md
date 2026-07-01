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
- Requested routing key `orders.order.status_changed.v1`: `[MISSING: Orders producer routing key orders.order.status_changed.v1; current source publishes orders.order.updated.v1 for status changes]`.
- Fixture verifier in Orders: `npm run verify:event-contracts`.

Allowed payload fields in the verified Orders contract are bounded to order references and safe lifecycle metadata. Events must not include customer objects, customer addresses, billing addresses, payment method details, provider secrets, bearer tokens, JWTs, passwords, raw credentials, tracking numbers, tracking URLs, operator email addresses, or approver display identities.

## Marketing Consumer Core

Marketing now has a transport-independent consumer core in `src/order-lifecycle-events.ts`.

It supports:

- Validating `orders.order.created.v1` and the currently verified status-change event, `orders.order.updated.v1`.
- Rejecting the requested but unproduced `orders.order.status_changed.v1` with a `[MISSING: ...]` blocker.
- Idempotency by `eventId`.
- Aggregate order signal statistics by event type, channel, and status.
- Order references as `orders:order:<orderId>`.
- Campaign attribution status as blocked when campaign/run/correlation references are absent from the Orders event contract.

It does not yet start a RabbitMQ listener. Marketing currently has no broker dependency, no queue binding, and no runtime consumer configuration.

## Runtime Blockers

- `[MISSING: Marketing RabbitMQ consumer transport and queue binding configuration for orders.events]`.
- `[MISSING: approved Marketing queue name, dead-letter behavior, replay/backfill policy, and consumer deployment switch]`.
- `[MISSING: Orders producer routing key orders.order.status_changed.v1; current source publishes orders.order.updated.v1 for status changes]`.
- `[MISSING: Orders event payload campaignId/runId/correlationId or approved attribution join contract for campaign-level attribution]`.

## Proposed Runtime Contract

When the runtime broker standard is approved, Marketing should add a small adapter that:

- Connects to the approved broker URL from environment configuration without logging secret values.
- Asserts or binds an approved durable Marketing-owned queue to `orders.events`.
- Binds `orders.order.created.v1` and the approved status-change key. Use `orders.order.updated.v1` if Orders keeps the current source contract, or `orders.order.status_changed.v1` only after Orders publishes it.
- Acknowledges messages only after `OrdersLifecycleAttributionAccumulator` or its persisted successor accepts the event.
- Deduplicates by `eventId` before changing Marketing-owned attribution/statistics state.
- Treats malformed or sensitive-field events as rejected evidence and does not trigger campaign execution.

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
