# Automated Marketplace Sales Point

## Purpose

Create canonical marketing documentation for the Alfares sales point: users can sell Alfares company or supplier discounted products, list their own products into Alfares platforms, and resell other users products from the shared product pool while Alfares automates marketplace sales operations.

## Canonical Positioning

Alfares is the marketplace sales automation layer for sellers who want to manage product decisions and fulfillment without manually repeating marketplace operations.

The offer has four concrete sales paths:

1. Users can sell company or supplier discounted products offered by Alfares.
2. Users can list their own products into Alfares platforms.
3. Users can resell other users products from the shared product pool.
4. Alfares automates marketplace selling work: publishing, listing preparation, account fill, payment handling, order automation, and sales-flow coordination.

The customer-facing responsibility stays narrow:

- Maintain product availability and product facts.
- Provide and keep valid marketplace access credentials.
- Decide which products and sales paths to use.
- Manage shipping and fulfillment obligations.
- Handle customer or platform exceptions that automation cannot safely resolve.

## Audience

Primary audience: sellers, supplier partners, and resale operators who want access to multiple product sources and automated marketplace execution.

Secondary audience: internal Alfares product, marketing, and integration teams that need one canonical description of this sales point.

## Value Proposition

Alfares turns product access into automated marketplace sales. A user can start from Alfares discounted supply, their own catalog, or shared-pool products, then rely on Alfares to prepare and operate the marketplace sales workflow. The user focuses on supply, access credentials, sales decisions, and shipping.

## Message Pillars

- Product source flexibility: Alfares supplier deals, own products, and shared-pool resale can all become sellable inventory.
- Marketplace automation: repetitive publishing, listing, account-fill, payment, and order-flow work is automated.
- Operator simplicity: the user manages products, credentials, sales choices, and shipping rather than every marketplace field and workflow step.
- Shared pool leverage: sellers can create resale offers from other users products where platform rules and product availability allow it.

## Intent Preservation Chain

### Vision

Alfares enables users to participate in marketplace commerce from several product sources without manually operating every listing, account, payment, and order step.

### Goal Impact

Marketing and product communication should make the core sales point clear: Alfares is not only a campaign engine. It is also the automation story around turning supplier deals, owned listings, and shared-pool products into marketplace sales.

### System

Marketing-microservice owns the canonical wording for this sales point in documentation. Downstream product, catalog, order, payment, and marketplace integrations remain outside this documentation task.

### Feature

Document a concise sales point covering:

- Alfares company or supplier discounted products.
- User-owned product listings.
- Other users products from the shared product pool.
- Automated marketplace operations for publishing, listings, account fill, payments, orders, and sales flow.

### Task

Create canonical marketing documentation inside `marketing-microservice` only.

### Execution Plan

1. Inspect remote `marketing-microservice` status and avoid unrelated dirty work.
2. Add this canonical documentation under `docs/orchestrator/`.
3. Do not edit landing files because landing ownership is reserved for the coordinating owner.
4. Run targeted validation commands without deployment.

### Coding Prompt

Implement documentation-only marketing copy for the automated marketplace sales point in remote `marketing-microservice`. Do not edit order lifecycle files, existing dirty docs, `public/index.html`, landing CSS, or runtime source. Preserve the IPS chain and mark unavailable facts explicitly.

### Code

Documentation file only: `docs/orchestrator/2026-07-02-automated-marketplace-sales-point.md`. No runtime business logic, public landing file, CSS file, order lifecycle file, schema, queue contract, or deploy script is in scope.

### Validation

Required validation for this task:

- `git diff --check`
- targeted grep for canonical sales terms in this documentation file
- `git status --short` to verify dirty-worktree boundaries and confirm no landing files were changed

## Known Unknowns

- [UNKNOWN: exact marketplace names that must be named in public copy, for example Heureka, Allegro, Aukro, Bazos, or other channels.]
- [UNKNOWN: final legal wording for customer responsibility around payment handling, platform credentials, shipping, and resale rights.]
- [UNKNOWN: product-pool eligibility rules, commission terms, inventory reservation rules, and supplier-discount constraints.]
- [MISSING: approved public pricing or margin claim for this sales point.]
- [MISSING: finalized marketplace account-permission model for automated account fill and order automation.]

## Parallel Execution Notes

This task is documentation-only and safe to run in parallel with unrelated runtime lanes because it owns a new orchestrator document. Landing copy remains owner-held to avoid overlap.

Status: ready now.
Validation owner: documentation worker.
Merge order: after unrelated dirty order lifecycle work is either merged or explicitly left as separate worktree state.
