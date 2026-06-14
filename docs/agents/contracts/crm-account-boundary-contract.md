# CRM And Account Boundary Contract

## Decision

CRM/account master data must not live inside `marketing-microservice`.

Marketing may provide CRM-like engagement workflows: campaigns, journeys, segmentation, approvals, dry-runs, run history, suppression, attribution references, and campaign audit. It must not become the master record for companies, accounts, opportunities, account health, sales pipeline, customer-success notes, or contact truth.

## Recommended Ownership

| Domain | Owner |
| --- | --- |
| Registered-user identity and contact data | `auth-microservice` |
| Non-registered lead identity and contact data | `leads-microservice` |
| Company/account master data | Future CRM/account service |
| Opportunities and pipeline stages | Future CRM/account service |
| Account owners and customer-success notes | Future CRM/account service |
| Account health and lifecycle stage | Future CRM/account service or analytics-derived read model owned by CRM/account |
| Campaigns, segments, journeys, runs, suppressions | `marketing-microservice` |
| Campaign outcome facts | `marketing-microservice` |
| Cross-app attribution and customer-insights read models | Analytics/event pipeline or customer-insights service |

## Future CRM/Account Read Model

When a CRM/account service exists, Marketing may read these fields as segmentation signals:

- `accountId`
- `companyId`
- `tenantId`
- `businessId`
- `appIds`
- `accountOwnerId`
- `lifecycleStage`
- `pipelineStage`
- `opportunityIds`
- `healthScore`
- `onboardingStatus`
- `renewalDate`
- `planTier`
- `riskLevel`
- `lastCustomerSuccessTouchAt`
- `sourceUpdatedAt`

Marketing may store selected IDs, snapshot values used for a campaign decision, and audit evidence. Marketing must not become the editable source for these CRM fields.

## CRM Console Composition

A future CRM console can compose:

- Auth user identity and contacts.
- Leads lead identity and contacts.
- CRM/account company, opportunity, and lifecycle data.
- Marketing campaigns, journeys, segments, and outcomes.
- Analytics attribution and customer-insights read models.

The console composition must not change source-of-truth ownership. Write actions must route to the owning service.

## Marketing Guardrails

- Marketing must not create or update accounts, companies, opportunities, owners, sales notes, or customer-success notes.
- Marketing must not store contact truth for CRM contacts.
- Marketing must not infer consent from CRM account state.
- B2B onboarding, renewal, upsell, and winback campaigns still require source-owned recipient consent and explicit campaign approval.
- CRM/account source outages must skip or fail safely without direct delivery.


## Read-Only Signal Contract

Goal 19.1 and Goal 19.2 are defined in `docs/agents/contracts/crm-account-signal-contract.md`. That contract drafts the future read-only account and opportunity signal shapes, lifecycle/owner/health/onboarding/renewal fields, non-ownership rules, safe failure evidence, and the explicit runtime blockers that must be resolved before Marketing adds a CRM source client.
