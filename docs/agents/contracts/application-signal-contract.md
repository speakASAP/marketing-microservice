# Application Signal Contract

## Purpose

Application signals let Marketing build segments from app/domain behavior while applications remain the source of event truth and Marketing remains the campaign control plane. This contract defines the common signal envelope shared by Flipflop, SpeakASap, Marathon, Bazos, Rent-A-Box, RunLayer, Shop Assistant, Statics, and future application signal providers.

Goal 11.1 scope is the common envelope only. App-specific catalogs, source clients, event ingestion, segment rule execution, and dry-run preview behavior are later Goal 11 chunks.

## Source Applications

Initial signal sources:

- Flipflop (`flipflop`)
- SpeakASap (`speakasap`)
- Marathon (`marathon`)
- Bazos (`bazos`)
- Rent-A-Box (`rent-a-box`)
- RunLayer (`runlayer`)
- Shop Assistant (`shop-assistant`)
- Statics (`statics`)


## Application-Specific Catalog

The initial app-specific event classes, lifecycle mappings, source object types, subject types, and allowed attributes are defined in `docs/agents/contracts/application-signal-catalog-contract.md`. The catalog extends this envelope but does not implement source clients, ingestion, executable segment rules, dry-run previews, or campaign execution behavior.

## Signal Ownership

Applications own raw behavior facts. Domain services own their domain facts. Marketing owns segment definitions, campaign decisions, dry-run results, and execution outcomes derived from those facts.

Applications must not implement local campaign engines, consent enforcement substitutes, notification delivery, or marketing frequency caps. Marketing must not copy application event stores, contact records, consent truth, provider credentials, or application-owned business objects into Marketing master data.

## Common Signal Envelope

Every application behavior signal exposed to Marketing must be expressible with this envelope. Providers may return the envelope directly from a read API or publish it through a future event pipeline, but the ownership and field semantics stay the same.

```json
{
  "schemaVersion": "marketing.application_signal.v1",
  "signalId": "runlayer:workflow_run:workflow_run_123:completed",
  "sourceService": "runlayer",
  "sourceSystem": "runlayer-api",
  "appId": "runlayer",
  "tenantId": "tenant_123",
  "businessId": "business_123",
  "brandId": "statex",
  "environment": "production",
  "subject": {
    "type": "registered_user",
    "ref": "auth:user:123",
    "sourceOwner": "auth",
    "sourceId": "123"
  },
  "eventType": "workflow.first_run_completed",
  "eventGroup": "activation",
  "lifecycleStage": "activation",
  "sourceObject": {
    "type": "workflow_run",
    "id": "workflow_run_123",
    "ref": "runlayer:workflow_run:workflow_run_123"
  },
  "occurredAt": "2026-06-13T00:00:00.000Z",
  "observedAt": "2026-06-13T00:00:05.000Z",
  "idempotencyKey": "runlayer:workflow_run_123:workflow.first_run_completed",
  "value": 1,
  "unit": "count",
  "attributes": {
    "workflowType": "import",
    "runCount": 1
  },
  "relatedRefs": [
    "tenant:tenant_123"
  ],
  "quality": {
    "isTest": false,
    "confidence": 1,
    "dedupeKey": "runlayer:workflow_run_123:completed"
  },
  "metadata": {
    "contract": "docs/agents/contracts/application-signal-contract.md"
  }
}
```

## Required Fields

| Field | Requirement | Meaning |
| --- | --- | --- |
| `schemaVersion` | Required | Envelope version. Initial value: `marketing.application_signal.v1`. |
| `signalId` | Required | Stable source-owned signal identifier. Must be unique within the source service and stable across retries. |
| `sourceService` | Required | Service or application that owns the raw behavior fact, such as `flipflop`, `speakasap`, `marathon`, `bazos`, `rent-a-box`, `runlayer`, `shop-assistant`, or `statics`. |
| `appId` | Required | Canonical app identifier from the tenant/app registry and application portfolio taxonomy. |
| `subject` | Required | Source-owned subject reference used for later recipient resolution. Must not contain direct contact addresses. |
| `eventType` | Required | Dot-delimited event name owned by the source app, such as `lesson.completed` or `reservation.created`. |
| `sourceObject` | Required | Source-owned object that produced the event. Stores references only, not copied business object state. |
| `occurredAt` | Required | ISO 8601 UTC timestamp for when the behavior happened in the source system. |

## Scope Fields

`tenantId`, `businessId`, `brandId`, and `environment` connect the signal to Marketing campaign scope and registry validation. `tenantId` and `appId` are required whenever the source behavior is tenant- or app-scoped. `brandId` is required when brand policy, sender identity, or campaign grouping differs by brand. Marketing stores these identifiers as references only; registry truth remains outside Marketing.

Optional localization fields may be added under `attributes` or future contract revisions, but campaign locale/timezone defaults continue to come from campaign scope and registry validation rather than raw app signals.

## Subject References

Signals must reference subjects without moving contact truth into Marketing. The normalized `subject.ref` values are:

- `auth:user:<id>` for registered users owned by auth-microservice.
- `leads:lead:<id>` for leads owned by leads-microservice.
- `crm:account:<id>` for future CRM/account records owned by a CRM/account service.
- `tenant:<id>` for tenant/account lifecycle events where a later resolver maps the tenant to eligible contacts.
- `anonymous:<source>:<id>` only for pre-consent behavioral facts that cannot be used for real campaign delivery until resolved to an eligible auth/leads/CRM subject by a source-owned contract.

`subject.sourceOwner` must identify the service that owns the subject truth. `subject.sourceId` is the source-owned identifier. Marketing resolves actual reachable recipients through auth/leads contracts before delivery. Signals must not include email addresses, phone numbers, Telegram handles, WhatsApp identifiers, or consent flags as replacement truth.

## Event And Object Semantics

`eventType` names the source behavior. `eventGroup` and `lifecycleStage` are optional normalization hints for Marketing segment rules and future campaign catalog filters. They do not authorize campaign execution by themselves.

`sourceObject.type`, `sourceObject.id`, and optional `sourceObject.ref` identify the source-owned object that generated the signal, such as a listing, lesson, reservation, workflow run, cart, report, dashboard, event registration, or product interaction. Marketing must store references and derived segment evidence only, not complete source object records.

## Time And Idempotency

`occurredAt` is the event time from the source application and must be ISO 8601 UTC. `observedAt` is optional ingestion/read-model time and must also be ISO 8601 UTC when present. Segment windows must use `occurredAt` unless a later contract explicitly says otherwise.

`idempotencyKey` is optional but recommended for event pipelines and source reads. If omitted, consumers may dedupe by `sourceService + signalId`. Replayed signals must not create duplicate segmentation evidence for the same source fact.

## Attributes, Values, And Metadata

`value` and `unit` are optional numeric or scalar measures for threshold rules, such as run count, cart value, progress percent, storage size, renewal days, or report view count.

`attributes` may contain source-owned, non-secret, segmentation-safe fields needed by later app catalogs. Keep attributes small and contract-oriented. Do not include message bodies, raw personal contact data, auth tokens, provider credentials, payment card data, private notes, or broad source object snapshots.

`metadata` is for operational traceability and contract version hints. It must not be required for segmentation decisions when a typed field exists.

## Related References

`relatedRefs` may include source-owned references that help later segment rules, such as `tenant:<id>`, `catalog:product:<id>`, `orders:order:<id>`, `crm:account:<id>`, or app-specific object refs. Related refs are not recipient identities and must not bypass recipient resolution, consent, unsubscribe, frequency caps, approval, or notification delegation.

## Quality Evidence

`quality` may include:

- `isTest`: true only for non-production/test fixture signals.
- `confidence`: numeric confidence from 0 to 1 when a source produces probabilistic facts.
- `dedupeKey`: optional stable dedupe key when it differs from `signalId`.
- `sourceRevision`: optional source read-model or event schema revision.

Marketing may use quality fields for dry-run evidence or safe skips, but quality fields must not replace source ownership or consent checks.


## Signal Source Client Contract

Goal 11.3 adds a read-only application signal source client. Marketing uses this client only when a segment includes `app_signals` in `sourceTypes`.

Default read endpoint:

```text
GET {APPLICATION_SIGNAL_SOURCE_URL}{APPLICATION_SIGNAL_SOURCE_PATH:-/marketing/application-signals}
```

Required query scope sent by Marketing:

- `tenantId`
- `appId`
- `brandId`
- `limit`

Optional query scope sent when present on the campaign or segment rules:

- `businessId`
- `environment`
- `productLine`
- `lifecycleScope`
- `eventType`
- `eventGroup`
- `lifecycleStage`
- `sourceService`
- `sourceObjectType`
- `sourceObjectId`
- `subjectRef`
- `occurredSince`
- `occurredUntil`

Accepted response shapes:

```json
{
  "signals": [
    {
      "schemaVersion": "marketing.application_signal.v1",
      "signalId": "flipflop:product:123:viewed",
      "sourceService": "flipflop",
      "appId": "flipflop",
      "tenantId": "statex",
      "brandId": "statex-main",
      "subject": {
        "type": "registered_user",
        "ref": "auth:user:123",
        "sourceOwner": "auth",
        "sourceId": "123"
      },
      "eventType": "product.viewed",
      "sourceObject": {
        "type": "product",
        "id": "123"
      },
      "occurredAt": "2026-06-13T00:00:00.000Z"
    }
  ]
}
```

Marketing may also accept existing list wrappers already used by source clients, such as `items`, `data`, `results`, or `recipients`, but `signals` is the preferred contract field for application signals.

The client validates the common envelope fields before using a signal. It extracts only source-owned subject references that can be resolved later through recipient owners:

- `auth:user:<id>` becomes an auth recipient filter reference.
- `leads:lead:<id>` becomes a leads recipient filter reference.
- Anonymous, tenant-only, CRM/account, and unsupported subjects do not create delivery recipients in this chunk.

The app-signal client filters recipients already resolved from auth/leads. It does not create contacts, store raw event truth, write event-ingestion state, infer consent, or send notifications.

Runtime configuration keys:

- `APPLICATION_SIGNAL_SOURCE_URL`
- `APPLICATION_SIGNAL_SOURCE_TOKEN`
- `APPLICATION_SIGNAL_SOURCE_PATH`
- `APPLICATION_SIGNAL_SOURCE_LIMIT`
- `APPLICATION_SIGNAL_SOURCE_TIMEOUT_MS`

Missing source URL, source outage, malformed envelope data, unsupported schema version, mismatched appId, missing subject/sourceObject, or non-UTC `occurredAt` all fail safely with `app_signals_source_unavailable:*` evidence and no notification delegation.

## Safe Failure Rules

- Signal source outage must fail dry-run or execution safely with evidence.
- Missing signal data must not cause Marketing to send to broad fallback audiences.
- Signals with missing required fields are invalid and must be ignored or surfaced as source failure evidence before real delivery.
- Signals with unresolved, anonymous, or unsupported subjects cannot produce real notification recipients.
- Signal metadata must not include provider credentials, raw auth tokens, unnecessary contact data, or source-owned consent replacement truth.
- Signal data may influence segmentation only; it must not bypass owner approval, consent, unsubscribe, frequency caps, throttling, max-send limits, idempotency, max-30 notification chunking, or notification delegation.

## Validation Expectations

Future Goal 11 chunks must validate this envelope at source-client or ingestion boundaries and cover at least:

- Required field presence and ISO 8601 UTC timestamps.
- Canonical `appId`, scope, source service, subject, and source object references.
- Safe rejection of malformed, unsupported, anonymous-unresolved, or secret-bearing signals.
- Dedupe behavior for replayed signals.
- Safe source outage behavior with no notification delegation.
