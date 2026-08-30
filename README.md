# Marketing Microservice

## status

marketing-microservice is an active production service (STATE.json: phase-7-goal-20-production-governance-enforced) providing the ecosystem's centralized campaign and segmentation engine.

## documentation authority

- `BUSINESS.md` for goals, constraints, and SLA
- `SYSTEM.md` for architecture, endpoints, and integrations
- `CLAUDE.md` for agent entry point and quick ops
- `docs/agents/master-prompt.md` for the implementation plan and orchestration role/phases/contracts
- `docs/agents/contracts/*.md` for frozen API contracts
- `docs/01_vision/VISION.md` for durable product direction

## capabilities

- Segment definitions from auth-microservice users, leads-microservice leads, and order-based data
- Campaign CRUD, scheduling, and idempotent execution with chunked notification calls (<=30 recipients per batch)
- Consent, unsubscribe, and per-user/per-channel frequency-cap enforcement in the execution path
- Structured decision/outcome logging with ISO timestamps and duration_ms
- Production governance runtime enforcement: risk classification, approval evidence, source-failure, quiet-hour, readiness, rollback, high-risk, restricted, and emergency-override gates before notification delegation
- Consumption of Orders-domain events for order-based segmentation (src/orders-events-consumer.ts)

## interfaces

- Campaign and segment CRUD APIs
- Campaign execution endpoint (scheduled or on-demand, batched, <=30 items per request)
- Unsubscribe and preference endpoints
- `GET /health`
- Protected write/execution APIs require `MARKETING_API_TOKEN` or `SERVICE_API_TOKEN`
- Domain: https://marketing.alfares.cz, Port: 4600/4601 (blue/green)

## development

- Stack: NestJS (TypeScript), PostgreSQL for campaigns, segments, and execution state
- Contract definitions frozen in docs/agents/contracts/marketing-campaign-contract.md, preferences-consent-contract.md, channel-registry-contract.md, integration-api-matrix.md
- All delivery is delegated to notifications-microservice; this service never sends email/messages directly

## configuration

- All configuration via `.env`; do not hardcode values; see `.env.example` for required keys
- Protected APIs require MARKETING_API_TOKEN or SERVICE_API_TOKEN, mapped from the service secret in Kubernetes
- HMAC secret for marketing unsubscribe links stored in Vault at secret/prod/marketing-microservice
- Before any `.env` change, create a backup and add new variable names (keys only) to `.env.example`

## deployment

- Deploy command: `./scripts/deploy.sh`
- Image: `localhost:5000/marketing-microservice:latest`
- Target: Kubernetes (k3s) `statex-apps` namespace
- Restart: `kubectl rollout restart deployment/marketing-microservice -n statex-apps`
- Logs: `kubectl logs -n statex-apps -l app=marketing-microservice -f`

## health and observability

- Health endpoint: `GET /health`
- Structured logging via `logging-microservice` (`LOGGING_SERVICE_URL`), including timestamps and duration_ms for operations
