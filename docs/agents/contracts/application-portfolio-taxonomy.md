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

## Shared Campaign Family Vocabulary

Campaign catalog metadata should use the same initial shared campaign family vocabulary as lifecycle metadata until app-specific blueprint families are explicitly contracted:

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

## Default Campaign Blueprints

Initial Goal 12.3 default campaign blueprints are application-specific suggestions only:

| Application | Blueprint ID | Family | Lifecycle stage | Audience |
| --- | --- | --- | --- | --- |
| Flipflop | `flipflop.abandoned-intent.default` | `abandoned_intent` | `abandoned_intent` | Shoppers with abandoned product or checkout intent. |
| SpeakASap | `speakasap.activation.default` | `activation` | `activation` | Trial learners and language-interest leads. |
| Marathon | `marathon.onboarding.default` | `onboarding` | `onboarding` | Newly registered participants. |
| Bazos | `bazos.reactivation.default` | `reactivation` | `reactivation` | Sellers with expired or inactive listings. |
| Rent-A-Box | `rent-a-box.renewal.default` | `renewal` | `renewal` | Storage customers approaching renewal. |
| RunLayer | `runlayer.feature-adoption.default` | `feature_adoption` | `feature_adoption` | B2B tenants needing workflow adoption. |
| Shop Assistant | `shop-assistant.post-purchase.default` | `post_purchase` | `post_purchase` | Post-purchase shoppers and recommendation users. |
| Statics | `statics.retention.default` | `retention` | `retention` | Inactive analytics workspaces. |

## Campaign Blueprint Rule

Campaign blueprints may propose default segment rules, channel strategy, lifecycle stage, campaign family, and template references per application. A blueprint is not an approved campaign, does not contain message bodies or execution commands, and does not own provider template delivery. Real delivery still requires campaign creation, explicit owner approval, consent checks, unsubscribe checks, frequency caps, throttling, idempotency, and notification delegation.
