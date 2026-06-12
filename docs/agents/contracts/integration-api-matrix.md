# Marketing Integration API Matrix

| Service | Ownership | Marketing usage | Required guardrail |
| --- | --- | --- | --- |
| auth-microservice | Registered users, contacts, preferences, consent | Read registered-user recipients and consent | Do not duplicate auth as source of truth |
| leads-microservice | Leads, contacts, preferences, consent | Read lead recipients and consent | Do not target leads without explicit consent |
| notifications-microservice | Email/Telegram/WhatsApp delivery and channel registry | Send delegated notification requests | Never send directly from marketing |
| orders-microservice | Order history and purchase signals | Optional segment signal source | Do not move order ownership into marketing |
| catalog-microservice | Product truth and product metadata | Optional product-based segment signal source | Do not move product truth into marketing |
| database-server | PostgreSQL storage | Persist campaigns, segments, runs, outcomes | Do not store secrets in application tables |
| logging-microservice | Centralized logs | Send structured operational/audit logs | Do not log secrets or sensitive tokens |
| nginx-microservice | Routing and ingress | Expose marketing API routes | Keep route ownership explicit |

## Current Local API Surface

- `GET /health`
- `POST /segments`
- `GET /segments`
- `PUT /segments/:id`
- `DELETE /segments/:id`
- `POST /campaigns`
- `GET /campaigns`
- `PUT /campaigns/:id`
- `DELETE /campaigns/:id`
- `POST /campaigns/:id/execute`
- `GET /executions`

## Verification Commands

```bash
npm run build
npm test
```

