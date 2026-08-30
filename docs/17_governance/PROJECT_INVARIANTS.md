# Project Invariants: Marketing Microservice

```yaml
id: PROJECT-INVARIANTS-marketing-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - BUSINESS.md
  - SYSTEM.md
  - docs/01_vision/VISION.md
downstream:
  - docs/01_vision/VISION.md
  - docs/12_validation/VAL-TASK-001-bootstrap-service.md
```

## purpose

These invariants protect marketing-microservice's consent-respecting, governance-gated, delegated-delivery intent.

## applicability

These invariants apply to segment resolution, campaign execution, consent/unsubscribe handling, and the Goal 20 production governance enforcement path.

## invariants

- MKT-INV-001: AI must never send campaigns without owner approval.
- MKT-INV-002: Unsubscribe requests must be honored within 24 hours.
- MKT-INV-003: Campaign frequency caps must be enforced per user per channel.
- MKT-INV-004: All delivery must go through notifications-microservice; marketing-microservice never sends directly.
- MKT-INV-005: Requests must not exceed 30 items per batch; do not increase timeouts without investigating logs first.
- MKT-INV-006: Goal 20 production governance gates (risk classification, approval evidence, source-failure, quiet-hour, readiness, rollback, high-risk, restricted, emergency-override) must be enforced before any notification delegation.

## exceptions

Exceptions to these invariants require explicit owner approval and must be documented in the affected task or validation record.

## review cadence

Review project invariants when entering a materially new scope, a deployment readiness gate, or a workflow change that affects operator trust or production safety.
