# Preferences And Consent Contract

## Owner

Auth-microservice owns registered-user identity, contact data, preferred channels, and registered-user consent/preferences.

Leads-microservice owns lead identity, contact data, preferred channels, and lead consent/preferences.

Marketing-microservice reads these records and enforces decisions. It does not become the source of truth for contact data or consent state.

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

## Unsubscribe Rules

- Unsubscribe must be honored immediately by marketing execution logic once visible.
- Operational systems must honor unsubscribe requests within 24 hours.
- Preference write ownership remains with auth/leads unless a future contract explicitly delegates a write-through endpoint.

