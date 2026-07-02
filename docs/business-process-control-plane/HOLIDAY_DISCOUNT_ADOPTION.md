# BPCP Holiday Discount Adoption

Status: service-local adoption contract
Date: 2026-07-02
Service: `marketing-microservice`
Central contract pack: `statex-ecosystem/docs/business-process-control-plane/`

## Role

Campaign provider for Holiday Discount content, slots, upsell copy, and notification template references.

## Responsibilities

- Own campaign name, copy, banners, content refs, audience language, and upsell recommendations.
- Provide campaign refs to BPCP.
- Consume order/payment lifecycle events only through verified contracts.
- Avoid becoming the workflow engine.

## Required interfaces

- Campaign content API or documented campaign refs.
- Slot content refs: `product_badge`, `cart_banner`, `upsell_block`, `post_purchase_message`.
- Template refs for notifications.

## Boundaries

- This service must not become the global owner of BPCP process definitions.
- This service must fail closed on invalid or unknown BPCP process versions.
- This service must keep existing domain ownership and invariants.
- This service must expose or document dry-run behavior before live execution.
- This service must not overwrite existing service contracts without an
  explicit integration owner and validation owner.

## Holiday Discount pilot expectations

- Recognize `holiday-discount-2026` only through versioned BPCP contracts.
- Preserve `processId`, `processVersion`, and `policyId` in every relevant
  decision, event, snapshot, log, or rendered experience.
- Support rollback by respecting BPCP pause and retired states.
- Keep process display and process execution separate where applicable.

## Blockers and unknowns

- Read-only local content contract: `GET /campaign-catalog/bpcp/holiday-discount-2026/content-contract`.
- Campaign ref: `holiday-2026-main`.
- [MISSING: canonical cross-service BPCP campaign content API path and response envelope]
- [MISSING: runtime queue contract for order lifecycle event consumption]
- [MISSING: notification template provider contract for Holiday Discount template refs]

## Validation evidence required before implementation is accepted

- Campaign fixture resolves by ref.
- Slot content can be fetched without monetary logic.
- Contract tests prove Marketing does not calculate final discount.

## Parallel handoff

This adoption doc is safe for a focused service owner to implement in parallel
after the central BPCP schemas are accepted. The service owner must not edit
shared BPCP schemas directly; schema changes go through the BPCP integration
owner.


## Marketing content refs lane

Marketing now owns an additive, read-only Holiday Discount content-ref contract for `processId=holiday-discount-2026`, `processVersion=1`, `policyRef=holiday-10-percent-selected-categories`, and campaign ref `holiday-2026-main`. The contract includes only content/template references for `product_badge`, `cart_banner`, `upsell_block`, and `post_purchase_message`. It does not calculate discounts, alter carts, own checkout totals, send notifications, or execute a campaign.

Fail-closed validation rejects unsupported slot names, missing or changed process refs, duplicate/missing required slots, and execution/delivery/pricing/cart/checkout fields in the content contract or slot metadata.
