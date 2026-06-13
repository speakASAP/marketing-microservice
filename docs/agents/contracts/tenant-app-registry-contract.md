# Tenant App Business Registry Contract

## Purpose

Marketing needs canonical tenant, app, business, brand, sender, locale, timezone, and policy references. Marketing must store references and validate them, but it must not become the tenant/app/business registry.

## Owner

The source of truth should be an existing platform registry service or a new tenant/app/business registry service. Until that service exists, this document defines the contract Marketing will expect.

## Required Registry Fields

| Field | Meaning |
| --- | --- |
| `tenantId` | Canonical tenant/workspace/customer identifier. |
| `businessId` | Legal or commercial business owner where different from tenant. |
| `appId` | Canonical application identifier, such as `flipflop`, `speakasap`, `marathon`, `bazos`, `rent-a-box`, `runlayer`, `shop-assistant`, or `statics`. |
| `brandId` | Brand or sender identity used for campaign grouping and channel policy. |
| `environment` | Production, staging, development, or test environment. |
| `defaultLocale` | Default locale for templates and landing/admin display. |
| `timezone` | Tenant/app timezone for quiet hours and scheduling. |
| `allowedChannels` | Channel list allowed for this tenant/app/brand. |
| `defaultChannelKey` | Optional default notifications channel registry key. |
| `legalSenderIdentity` | Legal sender identity reference, not provider credentials. |
| `policyRef` | Reference to quiet-hour, frequency, approval, and compliance policy. |
| `status` | Active, suspended, archived, or test-only state. |

## Marketing Usage

Marketing may use registry data to:

- Validate campaign and segment scope.
- Filter campaigns, segments, runs, and analytics by tenant/app/brand.
- Select default locale, timezone, channel policy, and channelKey references.
- Prevent campaign execution for inactive or invalid tenant/app/brand combinations.
- Record registry IDs and snapshot evidence in campaign audit state.

Marketing must not use registry data to:

- Own tenant/app/business truth.
- Store provider credentials.
- Bypass auth/leads consent and unsubscribe checks.
- Bypass notifications channel registry ownership.

## Safe Failure Rules

- Invalid tenant/app/brand references must fail validation before campaign execution.
- Registry outage before real execution must fail safely and prevent notification delegation when registry validation is required.
- Dry-run may report `registry_unavailable` or `registry_reference_invalid` without delivery.
- Test fixtures may be used only under explicit test configuration.

## Marketing Implementation Notes

Marketing validates registry references through TENANT_APP_REGISTRY_URL and optional TENANT_APP_REGISTRY_TOKEN, using TENANT_APP_REGISTRY_VALIDATE_PATH when configured. Test fixtures are allowed only when NODE_ENV=test and MARKETING_USE_TEST_REGISTRY_FIXTURES=true.

Current Marketing APIs require tenantId, appId, and brandId on new segment and campaign requests. List endpoints support scope filters such as tenantId, appId, brandId, businessId, productLine, lifecycleScope, and environment.
