# Marketing Integration API Matrix

| Service | Ownership | Marketing usage | Required guardrail |
| --- | --- | --- | --- |
| auth-microservice | Registered users, contacts, preferences, consent | Read registered-user recipients and tenant/app/purpose/channel consent; forward registered-user unsubscribe writes when configured | Do not duplicate auth as source of truth |
| leads-microservice | Leads, contacts, preferences, consent | Read lead recipients and tenant/app/purpose/channel consent; forward lead unsubscribe writes when configured | Do not target leads without explicit consent |
| notifications-microservice | Email/Telegram/WhatsApp delivery and channel registry | Send delegated notification requests and read registry metadata where needed | Never send directly from marketing |
| orders-microservice | Order history and purchase signals | Optional segment signal source | Do not move order ownership into marketing |
| catalog-microservice | Product truth and product metadata | Optional product-based segment signal source | Do not move product truth into marketing |
| Flipflop | App behavior and product/customer interaction signals | Optional application signal source | App must not become campaign engine |
| SpeakASap | App behavior and learning lifecycle signals | Optional application signal source | App must not become campaign engine |
| Marathon | Event, training, and participation signals | Optional application signal source | App must not become campaign engine |
| Bazos | Listing, buyer, seller, and category-interest signals | Optional application signal source | App must not become campaign engine |
| Rent-A-Box | Reservation, storage lifecycle, renewal, and upsell signals | Optional application signal source | App must not become campaign engine |
| RunLayer | Tenant onboarding, workflow usage, and B2B lifecycle signals | Optional application signal source | App must not become campaign engine |
| Shop Assistant | Cart, recommendation, merchant setup, and product intent signals | Optional application signal source | App must not become campaign engine |
| Statics | Report, dashboard, workspace, and subscription usage signals | Optional application signal source | App must not become campaign engine |
| tenant/app/business registry | Tenant, business, app, brand, sender identity, locale/timezone, policy references | Validate canonical tenant/app/brand scope | Marketing stores references only, not registry truth |
| future CRM/account service | Accounts, companies, opportunities, account owners, health, onboarding, renewal, customer-success notes | Read B2B account lifecycle signals | Marketing must not become CRM master database |
| analytics/customer-insights service | Attribution, funnels, cohorts, LTV, cross-app read models | Consume analytics read models and emit campaign facts | Marketing campaign facts are not complete customer truth |
| database-server | PostgreSQL storage | Persist campaigns, segments, runs, outcomes | Do not store secrets in application tables |
| logging-microservice | Centralized logs | Send structured operational/audit logs | Do not log secrets or sensitive tokens |
| nginx-microservice | Routing and ingress | Expose marketing API and frontend routes | Keep route ownership explicit |

## Contract Documents

- `docs/agents/contracts/ecosystem-ownership-contract.md`
- `docs/agents/contracts/auth-recipient-consent-contract.md`
- `docs/agents/contracts/leads-recipient-consent-contract.md`
- `docs/agents/contracts/lead-identity-linking-contract.md`
- `docs/agents/contracts/unsubscribe-source-write-contract.md`
- `docs/agents/contracts/application-portfolio-taxonomy.md`
- `docs/agents/contracts/crm-account-boundary-contract.md`
- `docs/agents/contracts/tenant-app-registry-contract.md`
- `docs/agents/contracts/analytics-attribution-contract.md`
- `docs/agents/contracts/application-signal-contract.md`
- `docs/agents/contracts/application-signal-catalog-contract.md`
- `docs/agents/contracts/marketing-campaign-contract.md`
- `docs/agents/contracts/preferences-consent-contract.md`
- `docs/agents/contracts/channel-registry-contract.md`

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
- `POST /campaigns/:id/approve`
- `POST /campaigns/:id/execute`
- `POST /campaigns/:id/dry-run`
- `GET /executions`
- `GET /preferences/:owner/:recipientId`
- `POST /preferences/unsubscribe`
- `POST /scheduler/run-due`

## Verification Commands

```bash
npm run build
npm test
```
