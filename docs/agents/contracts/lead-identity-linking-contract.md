# Lead-To-User Identity Linking Contract

## Owner

Leads-microservice owns lead identity, lead lifecycle state, lead contact data, lead consent, and lead conversion references.

Auth-microservice owns registered-user identity, registered-user contact data, registered-user preferences, and registered-user consent.

Marketing-microservice may read source-owned identity links to avoid duplicate campaign decisions during recipient resolution. Marketing must not become the source of truth for identity links, contact records, conversion state, or merged recipient profiles.

## Link Fields

Leads recipient responses may include any of these source-owned conversion/link fields:

- `convertedAuthUserId`
- `authUserId`
- `registeredUserId`
- `userId`
- `identityLink.authUserId`
- `identityLink.registeredUserId`
- `identity.authUserId`
- `identity.registeredUserId`

Auth recipient responses may include source-owned lead references for evidence only:

- `leadId`
- `sourceLeadId`
- `identityLink.leadId`
- `identity.leadId`

## Resolution Rules

During a single campaign run, Marketing may use these links as transient execution evidence:

1. Resolve auth and leads recipients from their source-owned contracts.
2. Normalize a converted lead with an auth user link to the canonical recipient identity key `auth:<authUserId>` for run-level deduplication only.
3. If both an auth recipient and a linked lead resolve to the same auth identity key, prefer the auth recipient for delivery decisions because auth owns registered-user contact and consent after conversion.
4. If only the linked lead is present, Marketing may evaluate that lead using leads-owned contact, consent, unsubscribe, and channel data. The link is still evidence, not Marketing-owned identity truth.
5. Unlinked leads keep the canonical recipient identity key `lead:<leadId>`.
6. Marketing must not write link state back to auth or leads in this chunk.
7. Marketing must not create or persist a merged contact record, golden profile, or CRM/account identity record.

## Consent And Unsubscribe Rules

- A converted lead that is delivered through an auth recipient must pass auth-owned consent and unsubscribe checks.
- A converted lead that is delivered through a lead recipient because no auth recipient was resolved must pass leads-owned consent and unsubscribe checks.
- Marketing must not infer consent from the existence of a conversion link.
- Marketing must not use a lead's pre-conversion consent to override auth-owned registered-user consent.

## Audit Evidence

Marketing may record run/outcome evidence containing source references such as `lead:<leadId>` and `auth:<authUserId>`. Evidence must not include raw contact data beyond existing delivery outcome fields, provider credentials, tokens, or message bodies.

## Failure Behavior

If links are missing, malformed, or inconsistent, Marketing must fall back to source owner IDs and existing consent enforcement. If auth or leads source calls fail, existing safe-failure behavior still applies and Marketing must not send directly.
