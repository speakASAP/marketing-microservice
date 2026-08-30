# Integration Contract: Marketing Microservice

```yaml
id: INTEGRATION-CONTRACT-marketing-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - SYSTEM.md
  - BUSINESS.md
downstream:
  - docs/11_tasks/TASK-001-bootstrap-service.md
  - docs/12_validation/VAL-TASK-001-bootstrap-service.md
```

## purpose

This contract records the ecosystem dependencies required for marketing-microservice to operate as the centralized, consent-respecting, governance-gated campaign and segmentation engine, and the fallback behavior when a dependency degrades.

## capability decisions

| Capability | Component | Decision | Reason |
|---|---|---|---|
| auth | auth-microservice | required | README.md and SYSTEM.md document AUTH_SERVICE_URL as required for user segments, preferences, and consent data. |
| postgres | database-server (db-server-postgres) | required | SYSTEM.md documents PostgreSQL via DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME for campaign and segment data. |
| redis | database-server (db-server-redis) | not-applicable | No Redis environment variable or code reference was found in this repository's .env.example or src/. |
| logging | logging-microservice | required | README.md and SYSTEM.md document LOGGING_SERVICE_URL for centralized logging of campaign decisions and outcomes. |
| notifications | notifications-microservice | required | README.md/BUSINESS.md/SYSTEM.md document that all outbound delivery is delegated to notifications-microservice via NOTIFICATION_SERVICE_URL; marketing-microservice never sends directly. |
| ai | ai-microservice | not-applicable | No AI-service integration is documented or referenced in this repository; BUSINESS.md's AI constraint governs human-in-the-loop approval of campaigns, not an AI-microservice API integration. |
| payments | payments-microservice | not-applicable | marketing-microservice does not process payments; it only orchestrates campaigns and segmentation. |
| catalog | catalog-microservice | not-applicable | No direct catalog-microservice integration is documented; product-related segmentation is described as order-based data via orders-microservice, not a direct catalog integration. |
| orders | orders-microservice | required | README.md/SYSTEM.md document optional ORDERS_SERVICE_URL for order-based segmentation, and src/orders-events-consumer.ts consumes Orders-domain events via RabbitMQ for segmentation. |
| warehouse | warehouse-microservice | not-applicable | No warehouse/inventory integration exists in this repository. |
| invoices | invoices-microservice | not-applicable | No invoicing integration exists in this repository. |
| object-storage | minio-microservice | not-applicable | No object-storage usage was found in this repository's code or configuration. |
| event-bus | RabbitMQ | required | src/orders-events-consumer.ts consumes Orders-domain events over RabbitMQ, configured via RABBITMQ_URL in .env.example. |
| docs-rag | docs-rag-microservice | required | This service is a documentation-onboarded ecosystem repository and should be discoverable via docs-rag-microservice, consistent with other onboarded services (e.g. leads-microservice AGENTS.md). |
| monitoring | monitoring-microservice | required | Runtime health and rollout readiness must be observable through the shared monitoring model, consistent with the documented GET /health endpoint and Kubernetes rollout restart procedure. |
| backups | backups-microservice | required | This service's PostgreSQL database holds production campaign, segment, and execution state and requires backup coverage consistent with other ecosystem databases. |

## data ownership

marketing-microservice owns campaigns, segments, execution state, and delivery outcomes. auth-microservice owns registered-user identity/preferences/consent. leads-microservice owns lead identity/preferences/consent. notifications-microservice owns outbound provider execution and channel registry state.

## authentication and authorization

- Protected write and execution APIs require MARKETING_API_TOKEN or SERVICE_API_TOKEN.
- Kubernetes maps MARKETING_API_TOKEN from the service secret.

## synchronous dependencies

- PostgreSQL reads/writes for campaign and segment data
- auth-microservice reads for user segments/preferences/consent
- leads-microservice reads for lead contacts/consent
- notifications-microservice calls for campaign delivery
- orders-microservice reads (optional) for order-based segments

## asynchronous dependencies

- RabbitMQ consumption of Orders-domain events for order-based segmentation
- Structured log delivery to logging-microservice

## degraded operation

When notifications-microservice is unavailable, campaign execution must fail closed rather than send directly. When Orders integration (HTTP or RabbitMQ) is unavailable, order-based segments go stale but auth/lead-based segmentation and existing campaigns remain unaffected. Production governance gates (Goal 20) block any send lacking approval evidence or exceeding risk thresholds regardless of dependency health.

## validation

- GET /health passes
- Campaign execution enforces <=30 items per batch and consent/frequency-cap checks
- Goal 20 governance gates enforced before every notification delegation
