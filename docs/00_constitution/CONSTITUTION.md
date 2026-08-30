# Project Constitution: Marketing Microservice

> Protected document. Human approval is required. AI agents may draft only from approved source material and must not override the approved baseline without explicit approval.

```yaml
id: CONSTITUTION-marketing-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
[]
downstream:
  - ../01_vision/VISION.md
  - ../17_governance/PROJECT_INVARIANTS.md
```

## purpose

This constitution protects marketing-microservice's intent: a centralized, consent-respecting, governance-gated campaign and segmentation engine that never sends directly and never bypasses owner approval.

## constitutional principles

### intent preservation
Every implementation artifact must trace back to this approved project intent.

### human-controlled change
Approval gates and scope boundaries are not optional. Changes to ownership, scope, or production deployment policy require human approval.

### scope boundaries
marketing-microservice remains a campaign/segmentation orchestrator; it never sends messages directly (delegated to notifications-microservice), and it never owns registered-user or lead identity data (owned by auth-microservice and leads-microservice respectively).

### data and security
- Secrets, tokens, credentials, and private evidence must never be committed or exposed in logs or docs.
- Execution evidence must be grounded in actual data and validation results.
- Unverified automation must be treated as blocked or draft until evidence exists.

### validation
No task is complete without evidence against acceptance criteria and the approved project goals.

## amendment process

1. Create or update a proposal under `docs/17_governance/` or a reviewed equivalent path.
2. Explain the reason, affected artifacts, and compatibility impact.
3. Obtain human approval.
4. Update dependent documents and rerun relevant validation.

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: marketing-microservice-onboarding-approved
