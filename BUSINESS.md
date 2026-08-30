# Business: Marketing Microservice

> Protected business baseline. Human approval is required before changes to the approved product scope.

```yaml
id: BUSINESS-marketing-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - docs/01_vision/VISION.md
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - SYSTEM.md
  - docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## problem

Every application in the ecosystem needs to run marketing campaigns (email/Telegram/WhatsApp) with consent, unsubscribe, and frequency-cap enforcement, without each service reimplementing notification and segmentation logic or risking unapproved/unconsented sends.

## target users and stakeholders

- flipflop-service, speakasap, beauty, statex as documented consumer applications
- Marketing/business owners who approve campaign runs under production governance
- End users and leads whose consent and unsubscribe preferences must be honored

## value proposition

marketing-microservice centralizes campaign and segmentation logic across the ecosystem, delegates all delivery to notifications-microservice, and enforces consent, frequency caps, and production governance gates so campaigns cannot run without owner approval or in violation of consent.

## goals

- Provide a centralized campaign and segmentation engine for email/Telegram/WhatsApp across all applications
- Enforce per-user/per-channel consent and frequency caps
- Honor unsubscribe requests within 24 hours
- Delegate all delivery to notifications-microservice, never sending directly
- Enforce production governance (risk classification, approval evidence, rollback, emergency-override gates) before any campaign send

## non-goals

- Directly sending email, Telegram, or WhatsApp messages (delegated to notifications-microservice)
- Owning registered-user identity or lead identity (owned by auth-microservice and leads-microservice respectively)
- Owning outbound provider execution or channel registry state (owned by notifications-microservice)

## success metrics

- Unsubscribe requests honored within 24 hours
- Zero campaigns sent without consent or without owner approval evidence
- Campaign frequency caps enforced per user per channel
- Goal 20 production governance gates block unapproved/high-risk sends

## business constraints

- AI must never send campaigns without owner approval
- Unsubscribe requests must be honored within 24h
- Campaign frequency caps must be enforced per user per channel
- All delivery via notifications-microservice, never direct
- Max 30 items per request (batch size for notification calls)
- Consumers: flipflop-service, speakasap, beauty, statex

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: marketing-microservice-onboarding-approved
