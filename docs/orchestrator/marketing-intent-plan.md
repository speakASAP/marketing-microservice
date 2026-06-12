# Marketing Intent Plan

This file is the compact owner-facing plan for preserving marketing-microservice intent across implementation sessions.

## Service Role

Marketing-microservice owns campaign orchestration for the Statex ecosystem: segments, campaigns, execution runs, consent/frequency decisions, channel selection requests, and delivery outcome records.

## Ownership Map

| Capability | Owning service | Marketing responsibility |
| --- | --- | --- |
| Campaign definitions | marketing-microservice | Create, update, schedule, approve, execute |
| Segment definitions | marketing-microservice | Define audience rules and source requirements |
| Registered-user contact data | auth-microservice | Read via contract, never duplicate as source of truth |
| Lead contact data | leads-microservice | Read via contract, never duplicate as source of truth |
| Consent/preferences | auth/leads | Enforce before execution |
| Outbound send providers | notifications-microservice | Request send, record outcome |
| Order/catalog signals | orders/catalog services | Use as segmentation inputs only |
| Campaign audit | marketing-microservice plus logging-microservice | Persist and log decisions |

## Near-Term Sequence

1. Preserve documentation and contract baseline.
2. Replace runtime stub contacts with auth/leads clients.
3. Persist campaigns, segments, runs, outcomes, and idempotency.
4. Add explicit owner approval and dry-run safety gates.
5. Harden scheduling, throttling, and frequency controls.
6. Add audit-grade compliance evidence.
7. Harden API validation and service authorization.

## Permanent Guardrails

- No direct email, Telegram, or WhatsApp sending from marketing.
- No real campaign execution without explicit owner approval.
- No marketing-purpose recipient without explicit consent.
- No bypass of unsubscribe state.
- No recipient chunk above 30 notification calls.
- No secrets, provider credentials, or sensitive tokens in docs or logs.

