# Marketing Intent Preservation

## Original Intent

Marketing-microservice is the centralized campaign and segmentation engine for the Statex ecosystem. It answers: who should receive a campaign, whether they may legally and operationally receive it, which channel should be requested, when the campaign should run, and what happened during execution.

It exists so each application can run marketing, retention, and allowed transactional-not-marketing communication without duplicating campaign orchestration, consent checks, frequency caps, or delivery outcome tracking.

## Intent Preservation Rules

1. Campaign orchestration is centralized. Applications request or consume campaigns instead of building their own marketing engines.
2. Delivery is delegated. Marketing never sends email or messages directly; all outbound communication goes through notifications-microservice.
3. Contact ownership is external. Auth owns registered users; leads owns non-registered leads. Marketing reads contact and preference data through contracts.
4. Consent is mandatory. Marketing-purpose sends require explicit consent and must honor unsubscribe state before delivery.
5. Owner approval is mandatory for real campaign execution. AI, automation, and tests must not trigger real recipient sends without explicit owner approval.
6. Frequency caps and throttling are safety controls, not optional optimizations.
7. Segments may use auth, leads, orders, catalog, and application signals, but marketing owns the segment definition and execution decision.
8. Audit evidence is required for campaign creation, execution, skips, consent checks, channel decisions, and delivery outcomes.
9. Runtime configuration must come from environment variables, Kubernetes, and Vault-managed secrets.
10. Every implementation goal must preserve these boundaries and record evidence.

## Drift Checks

Before any change, ask:

- Does this make marketing a better campaign and segmentation control plane?
- Does this accidentally move notification provider execution into marketing?
- Does this duplicate auth/leads contact or consent ownership?
- Does this allow marketing sends without explicit consent or owner approval?
- Does this weaken frequency caps, throttling, idempotency, or audit logging?
- Does this preserve the max-30 batch rule for outbound delivery work?
- Does this preserve existing public and internal API contracts unless the goal explicitly changes them?

