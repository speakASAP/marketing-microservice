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

- `catalogMetadata.campaignFamily`
- `catalogMetadata.lifecycleStage`
- `catalogMetadata.audienceKey`
- `catalogMetadata.audienceLabel`
- `catalogMetadata.catalogCategory`
- `catalogMetadata.catalogTags`
- `catalogMetadata.sourceBlueprintId`
- `description`
- `channelKey`
- `message.subject`
- `scheduleAt`
- `throttlePerMinute`

## Campaign Catalog Metadata

Goal 12.1 adds optional campaign catalog metadata for discovery across applications. Goal 12.2 makes `catalogMetadata.campaignFamily` and `catalogMetadata.lifecycleStage` shared enum values. Catalog metadata is owned by Marketing as part of campaign definition metadata, but it is non-executable. It may reference a future blueprint by ID, campaign family, lifecycle stage, audience label/key, category, and tags.

Allowed `catalogMetadata.lifecycleStage` values:

- `acquisition`
- `activation`
- `onboarding`
- `education`
- `feature_adoption`
- `retention`
- `reactivation`
- `winback`
- `renewal`
- `upsell`
- `cross_sell`
- `post_purchase`
- `abandoned_intent`
- `operational_notice`

Allowed `catalogMetadata.campaignFamily` values:

- `acquisition`
- `activation`
- `onboarding`
- `education`
- `feature_adoption`
- `retention`
- `reactivation`
- `winback`
- `renewal`
- `upsell`
- `cross_sell`
- `post_purchase`
- `abandoned_intent`
- `operational_notice`

Catalog metadata must not contain approval state, schedule state, dry-run flags, execution commands, notification provider data, message bodies, contact data, or consent/unsubscribe truth. Unsupported campaign family or lifecycle stage values must fail request validation instead of becoming ad hoc taxonomy. A campaign created from catalog metadata or a future blueprint still starts with `approvalStatus: pending` and cannot execute real delivery until the normal explicit owner approval, consent, unsubscribe, frequency-cap, throttling, idempotency, max-send, max-30 chunking, and notification delegation gates pass.

## Default Campaign Blueprints

Goal 12.3 adds a static default campaign blueprint catalog for the initial application portfolio. A blueprint is a suggestion bundle for business users and future catalog APIs. It may include:

- `blueprintId`
- `appId`
- Optional `productLine`
- Display `name` and `description`
- `campaignFamily`
- `lifecycleStage`
- `audienceKey` and `audienceLabel`
- `catalogCategory` and `catalogTags`
- Suggested `purpose`, `primaryChannel`, and `fallbackChannels`
- `templateRef` as a provider-template reference only
- Suggested segment name, source types, rules, and dynamic flag
- `catalogMetadata.sourceBlueprintId` pointing back to the blueprint

A blueprint must not contain campaign `status`, approval fields, schedule fields, execution commands, dry-run flags, message bodies, recipient/contact data, consent truth, unsubscribe truth, provider credentials, or notification-provider template content.

Read-only catalog endpoints:

- `GET /campaign-catalog/blueprints` lists default blueprints and supports `appId`, `productLine`, `purpose`, `campaignFamily`, `lifecycleStage`, `audienceKey`, `catalogCategory`, and `catalogTag` filters.
- `GET /campaign-catalog/blueprints/:blueprintId` returns one default blueprint or `blueprint_not_found`.
- `GET /campaign-catalog/campaigns` lists campaign definitions for catalog discovery and supports tenant/app/brand/business/product-line/lifecycle-scope/environment scope filters plus `purpose`, `campaignFamily`, `lifecycleStage`, `audienceKey`, `catalogCategory`, `catalogTag`, and `sourceBlueprintId` filters.

Catalog endpoints are read-only. They do not create campaigns, approve campaigns, execute campaigns, dry-run campaigns, resolve recipients, or call notifications.

Creating or applying a blueprint in a future API must create a normal draft campaign with `approvalStatus: pending`. Real delivery remains impossible until explicit owner approval and all normal consent, unsubscribe, frequency-cap, throttling, max-send, max-30 chunking, idempotency, registry validation, and notification delegation gates pass.

Goal 19.4 extends the default catalog with B2B CRM/account lifecycle blueprints for onboarding, renewal, upsell, and winback. These blueprints use `crm_accounts` only as a read-only segment source, carry CRM/account predicate suggestions only, and still require auth/leads recipient resolution plus explicit campaign approval before real delivery.

Initial default blueprints:

| Blueprint ID | App | Family | Lifecycle stage | Template ref |
| --- | --- | --- | --- | --- |
| `flipflop.abandoned-intent.default` | `flipflop` | `abandoned_intent` | `abandoned_intent` | `flipflop.abandoned-intent.default` |
| `speakasap.activation.default` | `speakasap` | `activation` | `activation` | `speakasap.activation.default` |
| `marathon.onboarding.default` | `marathon` | `onboarding` | `onboarding` | `marathon.onboarding.default` |
| `bazos.reactivation.default` | `bazos` | `reactivation` | `reactivation` | `bazos.reactivation.default` |
| `rent-a-box.renewal.default` | `rent-a-box` | `renewal` | `renewal` | `rent-a-box.renewal.default` |
| `runlayer.feature-adoption.default` | `runlayer` | `feature_adoption` | `feature_adoption` | `runlayer.feature-adoption.default` |
| `shop-assistant.post-purchase.default` | `shop-assistant` | `post_purchase` | `post_purchase` | `shop-assistant.post-purchase.default` |
| `statics.retention.default` | `statics` | `retention` | `retention` | `statics.retention.default` |
| `runlayer.crm-onboarding.default` | `runlayer` | `onboarding` | `onboarding` | `runlayer.crm-onboarding.default` |
| `runlayer.crm-renewal.default` | `runlayer` | `renewal` | `renewal` | `runlayer.crm-renewal.default` |
| `runlayer.crm-upsell.default` | `runlayer` | `upsell` | `upsell` | `runlayer.crm-upsell.default` |
| `runlayer.crm-winback.default` | `runlayer` | `winback` | `winback` | `runlayer.crm-winback.default` |

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
- `app_signals`
- `crm_accounts`

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


## Lifecycle Journey Definition Contract

Goal 13.1 adds draft lifecycle journey definitions. Marketing owns journey definitions as orchestration metadata that references existing campaigns, segments, and source-owned signal predicates. A journey definition may include:

- `journeyId`
- Tenant/app/brand registry scope fields
- `name` and optional `description`
- `trigger` with type `manual`, `segment_entry`, or `app_signal`
- Ordered `steps` that reference existing `campaignId` values and define `delayMinutes`
- Optional step `conditions` and `maxExecutionsPerRecipient`
- `exitRules` with type `segment_match`, `app_signal`, `campaign_engagement`, or `manual`
- `suppressionRules` with type `recently_sent`, `frequency_cap`, `unsubscribed`, or `segment_match`
- `status`, initially `draft`

Journey definitions must not contain message bodies, notification provider data, provider credentials, direct recipient/contact data, consent truth, unsubscribe truth, execution commands, dry-run commands, approval metadata, or schedule claims. Journey steps reference existing campaign definitions; they do not duplicate templates, message bodies, channels, approval state, or delivery behavior.

Protected journey definition endpoints:

- `POST /journeys` creates a draft journey definition after registry validation and referenced campaign/segment checks.
- `PUT /journeys/:id` updates a draft definition surface while preserving server-owned IDs, timestamps, and status.
- `DELETE /journeys/:id` removes a definition.

Read endpoints:

- `GET /journeys` lists journey definitions and supports tenant/app/brand/business/product-line/lifecycle-scope/environment scope filters.
- `GET /journeys/:id` returns one journey definition or `journey_not_found`.

Goal 13.1 journey endpoints do not activate journeys, approve journeys, enroll recipients, execute campaign steps, dry-run journeys, call notifications, resolve contacts, or modify source-owned preferences. Later Goal 13 chunks must keep journey step execution behind explicit owner approval and must reuse existing campaign execution so consent, unsubscribe, frequency caps, throttling, max-send limits, max-30 chunking, idempotency, registry validation, notification delegation, and audit evidence remain enforced.


Goal 13.2 adds explicit journey approval and activation gates. A journey starts with `approvalStatus: pending` and cannot become active until `POST /journeys/:id/approve` records `approvedBy` and `approvedAt`. `POST /journeys/:id/activate` requires approved evidence and changes only the journey definition status to `active`; it does not enroll recipients, schedule steps, execute campaigns, dry-run journeys, resolve contacts, call notifications, or bypass campaign approval/safety controls. Activation stores `activatedAt` for audit traceability.

Protected approval/activation endpoints:

- `POST /journeys/:id/approve` records explicit owner approval evidence for the journey definition.
- `POST /journeys/:id/activate` requires approved journey evidence and marks the journey active without executing steps.

## Safety Requirements

- Real campaign execution requires explicit owner approval.
- Draft or unapproved campaigns must not execute against real recipients.
- Dry-run must resolve recipients and decisions without notification calls.
- Marketing-purpose sends require explicit consent.
- Unsubscribed recipients must be skipped.
- Frequency caps must be enforced before notification calls.
- Recipient delivery work must be chunked at `<=30`.
- Missing notification configuration must fail safely without direct sending.

## Application Signal Segment Source

Segments may include `app_signals` as a read-only source type. Marketing calls the application signal source contract, validates `marketing.application_signal.v1` envelopes, extracts source-owned subject refs, then resolves reachable recipients through auth/leads before delivery. `app_signals` does not create contacts, own raw app truth, replace consent, or bypass approval/safety gates.

## CRM/Account Signal Segment Source

Segments may include `crm_accounts` as a read-only source type. Marketing calls the CRM/account signal source contract in `docs/agents/contracts/crm-account-signal-contract.md`, validates account/opportunity signal envelopes, extracts relationship-only `contactRefs`, and then resolves reachable recipients through auth/leads before delivery. `crm_accounts` does not create CRM master records, store contact truth, infer consent, own account/opportunity state, or bypass approval, consent, unsubscribe, frequency-cap, throttling, max-send, max-30 chunking, registry validation, idempotency, or notification delegation gates.

## Tenant/App Registry Scope

Campaigns and segments carry canonical tenantId, appId, and brandId references plus optional business, environment, locale/timezone, product-line, lifecycle, sender-identity, and policy references. Marketing stores these references only. Registry truth remains with the tenant/app/business registry service. Create/update and execution paths validate scope before mutation or delivery; invalid, inactive, or unavailable registry references fail safely before notification delegation.


Goal 13.3 adds scheduler/idempotency integration for journey steps. `POST /scheduler/run-due` may claim due steps from active, approved journeys after each step delay has elapsed from `activatedAt`. Claimed steps are persisted in Marketing-owned journey step claim state with scheduler owner, lock expiry, due timestamp, completion state, and run reference. Step execution uses deterministic idempotency keys in the form `journey:<journeyId>:<stepId>:<dueAt>` and delegates to the existing campaign executor for the referenced campaign. Duplicate scheduler invocations must not execute the same due journey step twice. Journey step scheduling does not create direct delivery logic, provider calls, contact ownership, consent truth, or a separate recipient engine; campaign approval, recipient consent, unsubscribe, frequency caps, throttling, max-send limits, max-30 chunking, registry validation, notification delegation, and audit evidence remain enforced by campaign execution.


Goal 13.4 adds dry-run journey preview support through protected `POST /journeys/:id/dry-run`. The preview returns enrollment context from the journey trigger, calculated next-action due times from step delays, and per-step campaign dry-run summaries from the existing campaign dry-run executor. Journey dry-run preview may run against draft, approved, or active journeys for planning, but it must not activate journeys, claim scheduler work, complete journey step claims, call notifications, record sent history, write source-owned preferences, or execute real delivery. Preview output must summarize recipient decision counts and reasons without embedding message bodies, provider credentials, authorization tokens, or notification-provider data.


Goal 13.5 adds journey step decision audit evidence. Due step claims persist Marketing-owned decision evidence with the journey status, journey approval evidence, activation timestamp, due timestamp, delay, referenced campaign ID, deterministic journey idempotency key, step condition keys, max-executions metadata, and exit/suppression rule references. Scheduler execution emits sanitized `journey_step_decision_audited` evidence with the journey/step/campaign/run IDs, due timestamp, claim status, aggregate recipient status counts, aggregate decision reason counts, total recipients/sent/skipped/failed, and rule metadata. This evidence must not include message bodies, recipient addresses, provider credentials, authorization tokens, notification-provider payloads, or source-owned contact/preference truth. Journey audit evidence records why Marketing claimed or completed a step; it does not send directly, create a separate recipient engine, or bypass the existing campaign executor controls for approval, consent, unsubscribe, frequency caps, throttling, max-send limits, max-30 chunking, registry validation, idempotency, and notification delegation.
