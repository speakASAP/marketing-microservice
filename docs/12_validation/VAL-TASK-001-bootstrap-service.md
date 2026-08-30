# Validation: Marketing Microservice IPS adoption bootstrap

```yaml
id: VAL-TASK-001-bootstrap-service
status: validated
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../11_tasks/TASK-001-bootstrap-service.md
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
downstream:
[]
```

## summary

The marketing-microservice repository now includes the complete required IPS adoption document set, reformatted from real pre-existing BUSINESS.md/SYSTEM.md/AGENTS.md/README.md/TASKS.md/STATE.json content plus observed .env.example and src/ facts, with no fabricated business claims.

## upstream goal

This validation closes `TASK-001-bootstrap-service`, which advances `../22_goal_impact/GOAL-IMPACT-TASK-001.md`.

## acceptance criteria evidence

- Required root and docs/ artifacts are present and populated with project-specific content
- Integration review covers all 16 capabilities with concrete required/not-applicable decisions and evidence-grounded reasons
- STATE.json and TASKS.md reflect the real current state, including the two open contract-gated follow-ups

## gate evidence

- `validate_adoption_profile.py --root marketing-microservice --phase planning` exits 0 (see command output recorded in the onboarding session)

## integration evidence

- RabbitMQ Orders-domain event consumption confirmed via src/orders-events-consumer.ts and RABBITMQ_URL in .env.example
- No Redis or object-storage references found in .env.example or src/, supporting the not-applicable decisions
- auth/leads/notifications/orders/logging integrations confirmed via README.md and SYSTEM.md's documented integration tables

## invariant evidence

MKT-INV-001..006 are drawn directly from BUSINESS.md (Constraints), README.md (Constraints, delivery delegation, batch limits), and STATE.json (Goal 20 governance enforcement) without alteration.

## sensitive-data evidence

No secrets, tokens, or recipient PII appear in any adoption artifact; only architectural facts and non-secret configuration variable names are referenced.

## replay and determinism evidence

Not applicable; no replay/determinism-sensitive behavior exists in this documentation-only bootstrap.

## issues and validation debt

No new validation debt was created. The pre-existing docs/orchestrator/VALIDATION_DEBT.md template contained only placeholder rows; it has been replaced with a clean ledger reflecting no active entries.

## deviations

None; scope was limited to the documentation adoption baseline as directed.

## recommendation

Approve for planning phase. Deployment-phase (implementation) validation is not required for a documentation-only onboarding.

## traceability confirmation

This validation confirms the traceability chain `TASK-001-bootstrap-service` -> `../22_goal_impact/GOAL-IMPACT-TASK-001.md` -> `EP-TASK-001-bootstrap-service.md` -> `VAL-TASK-001-bootstrap-service.md` is intact and evidenced.
