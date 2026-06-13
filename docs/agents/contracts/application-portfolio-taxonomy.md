# Application Portfolio Taxonomy

## Purpose

This taxonomy defines the initial application portfolio for Statex Marketing. It standardizes app identifiers, marketing motions, lifecycle stages, and signal responsibilities before application signal integration is implemented.

## Canonical Applications

| Application | Suggested `appId` | Primary audience | Primary marketing motions | Example source signals |
| --- | --- | --- | --- | --- |
| Flipflop | `flipflop` | Shoppers, buyers, sellers, subscribers | Acquisition, abandoned intent, purchase follow-up, reactivation, cross-sell | Product view, cart/checkout, purchase, category interest, inactivity. |
| SpeakASap | `speakasap` | Learners, trial users, paid students | Course onboarding, lesson progress, trial conversion, reactivation | Registration, language interest, lesson completed, progress stalled, subscription state. |
| Marathon | `marathon` | Participants, organizers, training users | Event signup, training activation, reminders, retention | Event registration, training milestone, attendance, inactivity. |
| Bazos | `bazos` | Buyers, sellers, listing owners | Listing activation, listing renewal, category alerts, reactivation | Listing created, listing expired, saved search, category interest, buyer response. |
| Rent-A-Box | `rent-a-box` | Storage customers, reservation leads, tenants | Reservation onboarding, move-in lifecycle, renewal, upsell | Reservation created, move-in date, storage status, renewal date, plan/capacity state. |
| RunLayer | `runlayer` | B2B tenants, workspace users, operators | Tenant onboarding, workflow activation, feature adoption, renewal/upgrade | Tenant created, first workflow, workflow run count, failed setup, usage tier. |
| Shop Assistant | `shop-assistant` | Merchants, shoppers, assistant users | Cart recovery, recommendations, merchant onboarding, retention | Cart event, recommendation interaction, merchant setup, product intent. |
| Statics | `statics` | Analytics users, workspace admins, report consumers | Report adoption, dashboard activation, account expansion, renewal | Report created, dashboard viewed, inactive workspace, plan usage. |

## Shared Lifecycle Vocabulary

Marketing campaign metadata should use a shared lifecycle vocabulary before app-specific labels are added:

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

## Shared Audience Types

- `registered_user`
- `lead`
- `buyer`
- `seller`
- `merchant`
- `learner`
- `participant`
- `tenant_owner`
- `workspace_user`
- `admin_user`
- `subscriber`
- `trial_user`
- `account_contact`

## App Signal Ownership Rules

- Applications own raw behavior facts.
- Marketing owns segment definitions and campaign decisions derived from facts.
- Signals must include stable subject references such as `auth:user:<id>`, `leads:lead:<id>`, or future CRM/account references.
- Signals must include `tenantId` and `appId` when applicable.
- Signals must include `occurredAt`, source service, event type, and stable source object ID.
- Signals must not transfer contact, consent, or provider credential ownership to Marketing.

## Campaign Blueprint Rule

Future campaign blueprints may propose default segment rules, channel strategy, lifecycle stage, and template references per application. A blueprint is not an approved campaign. Real delivery still requires campaign creation, explicit owner approval, consent checks, unsubscribe checks, frequency caps, throttling, idempotency, and notification delegation.
