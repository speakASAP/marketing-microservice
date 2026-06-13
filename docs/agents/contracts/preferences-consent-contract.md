# Preferences And Consent Contract

## Owner

Auth-microservice owns registered-user identity, contact data, preferred channels, and registered-user consent/preferences.

Leads-microservice owns lead identity, contact data, preferred channels, and lead consent/preferences.

Marketing-microservice reads these records and enforces decisions. It does not become the source of truth for contact data or consent state.

## Auth Registered-User Recipient Contract

The auth-specific tenant/app/purpose/channel recipient contract is defined in `docs/agents/contracts/auth-recipient-consent-contract.md`. Marketing must send campaign scope and requested channel fields to auth and must treat auth-owned channel denial as a skip before notification delegation.

## Leads Recipient Contract

The leads-specific tenant/app/purpose/channel recipient contract is defined in `docs/agents/contracts/leads-recipient-consent-contract.md`. Marketing must send campaign scope and requested channel fields to leads and must treat source-owned channel denial as a skip before notification delegation. Lead conversion references remain source-owned and are not copied into Marketing master records.

## Lead-To-User Identity Linking

Lead conversion and identity-linking behavior is defined in `docs/agents/contracts/lead-identity-linking-contract.md`. Marketing may use source-owned links to deduplicate run recipients, but auth and leads remain the sources of truth and Marketing must not create merged contact or identity master records.

## Required Recipient Fields

- Stable source owner: `auth` or `leads`.
- Stable source ID.
- Reachable address for the selected channel.
- Preferred channel.
- Fallback channels.
- Marketing consent state.
- Unsubscribe state.

## Enforcement Rules

- For `marketing` purpose, `marketing` consent must be true.
- Any unsubscribe state must skip the recipient.
- Frequency caps must be checked after consent and before delivery.
- Transactional-not-marketing messages may use stricter campaign primary-channel rules, but must not bypass unsubscribe or legal constraints unless the owner explicitly documents that contract.

## Public Preference API Contract

Marketing exposes public contract endpoints for preference visibility and unsubscribe intake without becoming the source of truth. `GET /preferences/:owner/:recipientId` returns source ownership metadata for `auth` or `leads`. `POST /preferences/unsubscribe` validates owner, recipient, optional channel, optional purpose, optional tenant/app/brand scope, optional request ID, and optional reason, then follows `docs/agents/contracts/unsubscribe-source-write-contract.md`. Marketing continues to honor unsubscribe state once visible through auth/leads recipient data during execution.

## Source-Owned Unsubscribe Writes

The unsubscribe write-through/source-owned write contract is defined in `docs/agents/contracts/unsubscribe-source-write-contract.md`. Marketing may forward unsubscribe intake to auth or leads when the source write endpoint is configured, but auth/leads remain the durable write owners. If forwarding cannot complete, Marketing returns accepted pending-source evidence and must not create replacement unsubscribe truth.

## Unsubscribe Rules

- Unsubscribe must be honored immediately by marketing execution logic once visible.
- Operational systems must honor unsubscribe requests within 24 hours.
- Preference write ownership remains with auth/leads unless a future contract explicitly delegates a write-through endpoint.

