# Vision: Marketing Microservice

> Protected intent baseline. Human approval is required before changes to the approved project direction.

```yaml
id: VISION-marketing-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../00_constitution/CONSTITUTION.md
downstream:
  - ../../BUSINESS.md
  - ../17_governance/PROJECT_INVARIANTS.md
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## one-sentence vision

Let any application in the ecosystem run consent-respecting, governance-gated marketing campaigns without reimplementing segmentation or delivery logic.

## problem statement

Applications across the ecosystem need to run marketing campaigns without duplicating segmentation, consent, frequency-cap, and delivery logic, and without risking unapproved or non-compliant sends. marketing-microservice centralizes this while delegating actual delivery and enforcing production governance gates.

## target users

- flipflop-service, speakasap, beauty, and statex as consumer applications
- Business/marketing owners who must approve campaign runs
- End users and leads whose consent and unsubscribe rights must be respected

## core user need

Applications need a single, trustworthy place to define segments and run multi-channel campaigns that always respect consent, frequency caps, and require explicit owner approval before sending.

## key outcomes

- Centralized segment and campaign management across all consumer applications
- Consent and frequency-cap enforcement on every campaign execution
- Unsubscribe requests honored within 24 hours
- Production governance gates block any unapproved or high-risk send

## non-goals

- Direct message delivery (owned by notifications-microservice)
- Registered-user or lead identity ownership (owned by auth-microservice/leads-microservice)
- Unrestricted AI-initiated campaign sends without human approval

## success criteria

- Idempotent campaign execution with chunked notification calls (<=30 recipients)
- Goal 20 production governance enforcement passes for risk classification, approval evidence, rollback, and emergency-override gates
- Zero campaigns sent without consent or explicit owner approval evidence

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: marketing-microservice-onboarding-approved
