# Application Signal Catalog Contract

## Purpose

This catalog defines the initial application-specific signal classes for Goal 11.2. It extends the common envelope in `docs/agents/contracts/application-signal-contract.md` without changing ownership: applications own raw behavior facts, Marketing owns segment definitions and campaign decisions derived from those facts.

Goal 11.2 is catalog-only. Source clients, event ingestion, executable segment rules, dry-run previews, and runtime failure evidence are later Goal 11 chunks.

## Catalog Rules

- Every cataloged signal must use `schemaVersion: marketing.application_signal.v1`.
- Every signal must include canonical `appId`, source-owned `signalId`, `sourceService`, `subject`, `eventType`, `sourceObject`, and `occurredAt`.
- `tenantId` is required for tenant/workspace/business-scoped behavior and recommended for all application behavior.
- `brandId` is required when the app supports multiple brands, senders, or legal identities.
- `subject.ref` must point to source-owned identity references, not contact details.
- Catalog attributes must be segmentation-safe and small. Do not include raw contact data, consent replacement truth, tokens, provider credentials, payment card data, message bodies, or private notes.
- A catalog entry only makes a signal eligible for segmentation. It does not authorize campaign execution or notification delivery.

## Shared Catalog Fields

| Field | Meaning |
| --- | --- |
| `eventType` | Dot-delimited source-owned behavior name. |
| `eventGroup` | Shared grouping used by segment rules and campaign catalog metadata. |
| `lifecycleStage` | Shared lifecycle vocabulary from `application-portfolio-taxonomy.md`. |
| `sourceObject.type` | Source-owned object class that generated the signal. |
| `subject.type` | Expected subject class. Examples: `registered_user`, `lead`, `tenant`, `workspace_user`, `merchant`, `learner`, `participant`. |
| `attributes` | Allowed non-secret segmentation fields for this event class. |

## Flipflop Signal Catalog

Canonical `appId`: `flipflop`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `product.viewed` | `product_intent` | `acquisition` | `product` | `registered_user`, `lead`, `anonymous` | `productId`, `sku`, `categoryId`, `sellerId`, `priceBand`, `currency`, `viewCount`, `sessionAgeMinutes`. |
| `cart.item_added` | `abandoned_intent` | `abandoned_intent` | `cart` | `registered_user`, `lead`, `anonymous` | `cartId`, `productId`, `sku`, `categoryId`, `quantity`, `cartValue`, `currency`. |
| `checkout.started` | `abandoned_intent` | `abandoned_intent` | `checkout` | `registered_user`, `lead` | `checkoutId`, `cartId`, `cartValue`, `currency`, `paymentMethodType`, `shippingCountry`. |
| `purchase.completed` | `post_purchase` | `post_purchase` | `order` | `registered_user`, `lead` | `orderId`, `orderValue`, `currency`, `categoryIds`, `skuCount`, `firstPurchase`. |
| `category.interest_detected` | `category_interest` | `retention` | `category` | `registered_user`, `lead`, `anonymous` | `categoryId`, `interestScore`, `viewCount`, `daysSinceLastPurchase`. |
| `user.inactive` | `reactivation` | `reactivation` | `activity_window` | `registered_user`, `lead` | `inactiveDays`, `lastEventType`, `lastPurchaseDays`, `lifetimeOrderCount`. |

## SpeakASap Signal Catalog

Canonical `appId`: `speakasap`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `learner.registered` | `registration` | `activation` | `learner_profile` | `registered_user`, `lead` | `languageCode`, `placementLevel`, `registrationSource`, `trialEligible`. |
| `course.interest_selected` | `course_intent` | `acquisition` | `course` | `registered_user`, `lead` | `languageCode`, `courseId`, `level`, `interestSource`. |
| `lesson.completed` | `learning_progress` | `education` | `lesson` | `registered_user` | `courseId`, `lessonId`, `languageCode`, `level`, `completionPercent`, `streakDays`. |
| `progress.stalled` | `learning_stall` | `retention` | `course_progress` | `registered_user` | `courseId`, `languageCode`, `inactiveDays`, `completedLessons`, `remainingLessons`. |
| `trial.started` | `trial` | `activation` | `subscription` | `registered_user`, `lead` | `trialId`, `planCode`, `languageCode`, `trialDays`. |
| `subscription.state_changed` | `subscription` | `renewal` | `subscription` | `registered_user` | `subscriptionId`, `previousState`, `newState`, `planCode`, `renewalDays`. |

## Marathon Signal Catalog

Canonical `appId`: `marathon`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `event.registration_started` | `event_intent` | `acquisition` | `event_registration` | `registered_user`, `lead` | `eventId`, `distanceKm`, `city`, `registrationSource`, `priceBand`. |
| `event.registered` | `event_signup` | `activation` | `event_registration` | `registered_user`, `lead` | `eventId`, `distanceKm`, `city`, `registrationTier`, `teamId`. |
| `training.plan_started` | `training_activation` | `onboarding` | `training_plan` | `registered_user` | `planId`, `distanceKm`, `weeksToEvent`, `fitnessLevel`. |
| `training.milestone_reached` | `training_progress` | `retention` | `training_activity` | `registered_user` | `planId`, `milestoneName`, `distanceKm`, `weekNumber`, `completionPercent`. |
| `event.attended` | `participation` | `post_purchase` | `event_attendance` | `registered_user` | `eventId`, `distanceKm`, `finishStatus`, `finishTimeMinutes`. |
| `participant.inactive` | `reactivation` | `reactivation` | `activity_window` | `registered_user`, `lead` | `inactiveDays`, `lastEventId`, `lastTrainingDays`, `registeredEventCount`. |

## Bazos Signal Catalog

Canonical `appId`: `bazos`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `listing.created` | `listing_activation` | `activation` | `listing` | `registered_user`, `lead` | `listingId`, `categoryId`, `price`, `currency`, `city`, `sellerType`. |
| `listing.expiring` | `listing_renewal` | `renewal` | `listing` | `registered_user`, `lead` | `listingId`, `categoryId`, `daysUntilExpiry`, `viewCount`, `replyCount`. |
| `listing.expired` | `listing_reactivation` | `reactivation` | `listing` | `registered_user`, `lead` | `listingId`, `categoryId`, `expiredDays`, `viewCount`, `replyCount`. |
| `saved_search.created` | `buyer_interest` | `retention` | `saved_search` | `registered_user`, `lead` | `savedSearchId`, `categoryId`, `queryHash`, `city`, `priceMin`, `priceMax`. |
| `category.interest_detected` | `category_interest` | `retention` | `category` | `registered_user`, `lead`, `anonymous` | `categoryId`, `interestScore`, `viewCount`, `replyCount`. |
| `buyer.response_sent` | `buyer_engagement` | `activation` | `listing_response` | `registered_user`, `lead` | `listingId`, `categoryId`, `sellerId`, `responseCount`, `city`. |

## Rent-A-Box Signal Catalog

Canonical `appId`: `rent-a-box`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `reservation.created` | `reservation` | `activation` | `reservation` | `registered_user`, `lead` | `reservationId`, `locationId`, `boxSize`, `startDate`, `durationMonths`, `source`. |
| `move_in.scheduled` | `move_in` | `onboarding` | `reservation` | `registered_user`, `lead` | `reservationId`, `locationId`, `moveInDate`, `boxSize`, `accessType`. |
| `storage.active` | `customer_lifecycle` | `retention` | `storage_contract` | `registered_user` | `contractId`, `locationId`, `boxSize`, `startedAt`, `planCode`. |
| `renewal.upcoming` | `renewal` | `renewal` | `storage_contract` | `registered_user` | `contractId`, `renewalDate`, `daysUntilRenewal`, `planCode`, `monthlyValue`. |
| `capacity.threshold_reached` | `upsell` | `upsell` | `storage_usage` | `registered_user` | `contractId`, `usagePercent`, `boxSize`, `recommendedBoxSize`. |
| `reservation.abandoned` | `abandoned_intent` | `abandoned_intent` | `reservation` | `registered_user`, `lead` | `reservationId`, `locationId`, `boxSize`, `abandonedMinutes`, `quotedValue`. |

## RunLayer Signal Catalog

Canonical `appId`: `runlayer`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `tenant.created` | `tenant_onboarding` | `onboarding` | `tenant` | `tenant`, `registered_user` | `tenantId`, `planCode`, `createdByRole`, `workspaceSize`. |
| `workflow.created` | `workflow_activation` | `activation` | `workflow` | `registered_user`, `workspace_user`, `tenant` | `workflowId`, `workflowType`, `connectorCount`, `createdByRole`. |
| `workflow.first_run_completed` | `workflow_activation` | `activation` | `workflow_run` | `registered_user`, `workspace_user`, `tenant` | `workflowId`, `runId`, `workflowType`, `durationMs`, `connectorCount`. |
| `workflow.run_failed` | `setup_assistance` | `retention` | `workflow_run` | `registered_user`, `workspace_user`, `tenant` | `workflowId`, `runId`, `failureClass`, `retryCount`, `connectorType`. |
| `feature.adopted` | `feature_adoption` | `feature_adoption` | `feature_usage` | `registered_user`, `workspace_user`, `tenant` | `featureKey`, `usageCount`, `firstUsed`, `role`. |
| `usage.tier_threshold_reached` | `upgrade_intent` | `upsell` | `usage_window` | `tenant`, `registered_user` | `usageMetric`, `usagePercent`, `planCode`, `billingPeriodDays`. |

## Shop Assistant Signal Catalog

Canonical `appId`: `shop-assistant`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `cart.created` | `cart_intent` | `abandoned_intent` | `cart` | `registered_user`, `lead`, `anonymous` | `cartId`, `merchantId`, `cartValue`, `currency`, `itemCount`. |
| `cart.abandoned` | `cart_recovery` | `abandoned_intent` | `cart` | `registered_user`, `lead` | `cartId`, `merchantId`, `cartValue`, `currency`, `abandonedMinutes`, `itemCount`. |
| `recommendation.clicked` | `recommendation_engagement` | `retention` | `recommendation` | `registered_user`, `lead`, `anonymous` | `recommendationId`, `merchantId`, `productId`, `categoryId`, `rank`, `modelKey`. |
| `merchant.setup_started` | `merchant_onboarding` | `onboarding` | `merchant_profile` | `merchant`, `registered_user` | `merchantId`, `setupStep`, `platform`, `catalogSize`. |
| `merchant.setup_completed` | `merchant_activation` | `activation` | `merchant_profile` | `merchant`, `registered_user` | `merchantId`, `platform`, `catalogSize`, `integrationCount`. |
| `product.intent_detected` | `product_intent` | `acquisition` | `product` | `registered_user`, `lead`, `anonymous` | `merchantId`, `productId`, `categoryId`, `intentScore`, `priceBand`. |

## Statics Signal Catalog

Canonical `appId`: `statics`.

| Event type | Event group | Lifecycle stage | Source object type | Subject types | Allowed attributes |
| --- | --- | --- | --- | --- | --- |
| `workspace.created` | `workspace_onboarding` | `onboarding` | `workspace` | `tenant`, `registered_user` | `workspaceId`, `planCode`, `createdByRole`, `teamSize`. |
| `report.created` | `report_activation` | `activation` | `report` | `registered_user`, `workspace_user`, `tenant` | `reportId`, `reportType`, `dataSourceCount`, `createdByRole`. |
| `dashboard.viewed` | `dashboard_adoption` | `feature_adoption` | `dashboard` | `registered_user`, `workspace_user` | `dashboardId`, `dashboardType`, `viewCount`, `daysSinceCreated`. |
| `workspace.inactive` | `reactivation` | `reactivation` | `activity_window` | `tenant`, `registered_user` | `inactiveDays`, `lastReportDays`, `lastDashboardViewDays`, `activeUserCount`. |
| `plan.usage_threshold_reached` | `expansion` | `upsell` | `usage_window` | `tenant`, `registered_user` | `usageMetric`, `usagePercent`, `planCode`, `billingPeriodDays`. |
| `subscription.renewal_upcoming` | `renewal` | `renewal` | `subscription` | `tenant`, `registered_user` | `subscriptionId`, `planCode`, `renewalDate`, `daysUntilRenewal`, `workspaceCount`. |

## Cross-App Normalization

The same behavior can have app-specific meaning, but segment rules should prefer these shared groups when possible:

| Shared group | Typical use |
| --- | --- |
| `product_intent`, `course_intent`, `event_intent`, `buyer_interest`, `cart_intent` | Acquisition and abandoned intent audiences. |
| `registration`, `tenant_onboarding`, `workspace_onboarding`, `merchant_onboarding` | New user, tenant, merchant, or workspace onboarding. |
| `learning_progress`, `training_progress`, `workflow_activation`, `report_activation`, `dashboard_adoption` | Activation, education, and feature adoption audiences. |
| `listing_renewal`, `renewal`, `subscription` | Renewal and retention audiences. |
| `reactivation`, `listing_reactivation`, `learning_stall` | Reactivation or winback audiences. |
| `upsell`, `upgrade_intent`, `expansion` | Upgrade and expansion audiences. |

## Forbidden Catalog Expansions

Future catalog additions must not add fields or event classes that require Marketing to own:

- Direct contact addresses or handles.
- Consent, unsubscribe, or preference truth.
- Provider credentials or notification channel registry behavior.
- Raw app event stores or full source object snapshots.
- CRM/account master records.
- Campaign execution decisions inside application services.

## Validation Expectations

Future Goal 11 runtime chunks must add tests that cover every signal class selected for implementation, including malformed catalog entries, missing required envelope fields, unsupported app IDs, unresolved subjects, source outages, and replay/idempotency behavior. Until those chunks exist, this catalog is a contract reference only.
