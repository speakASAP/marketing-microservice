# Marketing Campaign Contract

## Owner

Marketing-microservice owns campaign and segment definitions, execution runs, delivery decisions, and delivery outcome records.

## Campaign Model

Required fields:

- `tenant`
- `name`
- `segmentId`
- `templateRef`
- `message.body`

Defaulted fields:

- `purpose`: `marketing`
- `primaryChannel`: `email`
- `fallbackChannels`: `[]`
- `frequencyCapPerDay`: `1`
- `status`: `draft`

Important optional fields:

- `description`
- `channelKey`
- `message.subject`
- `scheduleAt`
- `throttlePerMinute`

## Segment Model

Required fields:

- `name`
- `sourceTypes`
- `rules`
- `isDynamic`

Supported source types:

- `auth_users`
- `leads`
- `orders`

## Execution Contract

Execution requires:

- Existing campaign.
- Existing segment.
- Idempotency key via `x-idempotency-key` or request body.
- Recipient eligibility checks before delivery.
- Outbound notification delegation only through notifications-microservice.

Execution output must include:

- Run ID.
- Campaign ID.
- Idempotency key.
- Total recipients.
- Total sent.
- Per-recipient outcome with decision reason.

## Safety Requirements

- Real campaign execution requires explicit owner approval.
- Marketing-purpose sends require explicit consent.
- Unsubscribed recipients must be skipped.
- Frequency caps must be enforced before notification calls.
- Recipient delivery work must be chunked at `<=30`.
- Missing notification configuration must fail safely without direct sending.

