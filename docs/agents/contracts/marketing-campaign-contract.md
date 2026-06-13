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
- `approvalStatus`: `pending`

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

## Approval Model

Real execution requires campaign approval metadata recorded by marketing:

- `approvalStatus`: `pending`, `approved`, or `revoked`.
- `approvedBy`: owner/actor identifier required for approval.
- `approvedAt`: approval timestamp.
- `approvalNote`: optional owner note.

Approval is recorded through `POST /campaigns/:id/approve`. Direct campaign updates must not silently set approval metadata.

## API Authorization And Validation Contract

Protected write and execution APIs require a service token through `Authorization: Bearer <token>` or `x-service-token`. The token is configured with `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`. Public health/list endpoints and public preference/unsubscribe contract endpoints do not require this token.

Invalid request bodies return stable JSON errors with an `error` code and, where applicable, a `fields` object keyed by invalid field name. Campaign and segment APIs validate required fields, enum values, positive numeric limits, read-only IDs/approval fields, and ISO 8601 UTC schedule values before mutating state. Real execution requires an idempotency key through `x-idempotency-key` or request body.

## Execution Contract

Execution requires:

- Existing campaign.
- Existing segment.
- Idempotency key via `x-idempotency-key` or request body.
- For real delivery, approved campaign status with `approvedBy` and `approvedAt` evidence.
- Recipient eligibility checks before delivery.
- Outbound notification delegation only through notifications-microservice.

Dry-run execution may run without approval and must not call notifications-microservice or record sent history.

Execution output must include:

- Run ID.
- Campaign ID.
- Idempotency key.
- Total recipients.
- Total sent.
- Per-recipient outcome with decision reason.

## Scheduling Contract

Scheduled execution is invoked through `POST /scheduler/run-due`. Marketing must claim due campaigns before execution by recording scheduler lock owner and lock expiry on the campaign record. Scheduled runs use deterministic idempotency keys in the form `scheduled:<campaignId>:<scheduleAt>` so duplicate schedulers cannot double-send the same scheduled run. Paused campaigns must not be claimed or executed by the scheduler.

Scheduler execution still requires approval metadata and all recipient consent, unsubscribe, frequency-cap, max-send, and max-30 chunk checks before notification delegation.

## Audit Logging Contract

Marketing audit logs must include ISO timestamps, `duration_ms`, service name, campaign/run identifiers where available, and sanitized decision metadata. Message bodies, tokens, authorization headers, provider credentials, and recipient addresses must not be forwarded to logging-microservice audit payloads. Cross-service notification calls must include an `x-correlation-id` header and delivery outcomes persist the same correlation ID for traceability.

## Safety Requirements

- Real campaign execution requires explicit owner approval.
- Draft or unapproved campaigns must not execute against real recipients.
- Dry-run must resolve recipients and decisions without notification calls.
- Marketing-purpose sends require explicit consent.
- Unsubscribed recipients must be skipped.
- Frequency caps must be enforced before notification calls.
- Recipient delivery work must be chunked at `<=30`.
- Missing notification configuration must fail safely without direct sending.

