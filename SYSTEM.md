# System: Marketing Microservice

```yaml
id: SYSTEM-marketing-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - BUSINESS.md
  - docs/01_vision/VISION.md
downstream:
  - docs/06_architecture/INTEGRATION_CONTRACT.md
  - docs/11_tasks/TASK-001-bootstrap-service.md
```

## purpose

marketing-microservice is the ecosystem's centralized campaign and segmentation engine, orchestrating multi-channel marketing campaigns while delegating all delivery to notifications-microservice and enforcing consent and production governance.

## responsibilities

- Define segments from auth-microservice users, leads-microservice leads, and order-based data
- Create, schedule, and execute campaigns with chunked, consent-checked, frequency-capped notification calls
- Enforce production governance gates (risk classification, approval evidence, rollback, emergency override) before delegating sends
- Provide unsubscribe and preference management endpoints
- Consume Orders-domain events for order-based segmentation

## non-responsibilities

- It does not send email, Telegram, or WhatsApp messages directly; all delivery goes through notifications-microservice
- It does not own registered-user identity/preferences (auth-microservice) or lead identity/preferences (leads-microservice)
- It does not own outbound provider execution or channel registry state (notifications-microservice)

## inputs

- Segment and campaign definitions via CRUD APIs
- User/preference data from auth-microservice
- Lead/consent data from leads-microservice
- Order-based segmentation data from orders-microservice (optional) and Orders-domain events via RabbitMQ

## outputs

- Campaign execution requests delegated to notifications-microservice
- Structured decision/outcome logs (ISO timestamps, duration_ms) to logging-microservice
- Unsubscribe and preference state changes

## dependencies

- PostgreSQL via DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME for campaign and segment data
- logging-microservice via LOGGING_SERVICE_URL
- auth-microservice via AUTH_SERVICE_URL for user segments/preferences/consent
- leads-microservice via LEADS_SERVICE_URL for lead contacts/consent
- notifications-microservice via NOTIFICATION_SERVICE_URL for all delivery
- orders-microservice via ORDERS_SERVICE_URL (optional) for order-based segments
- RabbitMQ via RABBITMQ_URL, consumed in src/orders-events-consumer.ts for Orders-domain events

## upstream traceability

This system implements the approved intent in `BUSINESS.md` and the product vision in `docs/01_vision/VISION.md`.

## downstream artifacts

- `docs/06_architecture/INTEGRATION_CONTRACT.md`
- `docs/11_tasks/TASK-001-bootstrap-service.md`
- `docs/12_validation/VAL-TASK-001-bootstrap-service.md`
- `docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`

## validation criteria

- GET /health passes
- Campaign execution enforces <=30 items per batch and consent/frequency-cap checks
- Goal 20 production governance gates enforced (risk classification, approval evidence, source-failure, quiet-hour, readiness, rollback, high-risk, restricted, emergency-override)

## open questions

- Broader campaign attribution ownership remains blocked pending an approved analytics/conversion owner contract (STATE.json goal_18_status).
- Production CRM/account use of the Goal 19 integration remains disabled until the source service URL and source-service auth are configured (STATE.json goal_19_status).
