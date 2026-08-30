# Execution Plan: Marketing Microservice IPS adoption bootstrap

```yaml
id: EP-TASK-001-bootstrap-service
status: validated
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../11_tasks/TASK-001-bootstrap-service.md
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
downstream:
  - ../12_validation/VAL-TASK-001-bootstrap-service.md
```

## upstream traceability

This plan implements `../11_tasks/TASK-001-bootstrap-service.md`, which in turn advances `../22_goal_impact/GOAL-IMPACT-TASK-001.md`.

## scope

- Root IPS artifacts
- Protected governance docs
- Bootstrap task chain docs
- ips-adoption.json integration review

## non-goals

- No service code, schema, or deployment changes
- No resolution of the open attribution-ownership or CRM/account-integration follow-ups

## project invariants

This plan preserves MKT-INV-001..006 by documenting them, not altering them.

## sensitive-data handling

No secrets or recipient PII are read, generated, or committed; only architectural facts drawn from README/BUSINESS/SYSTEM/AGENTS/TASKS/STATE and non-secret .env.example variable names are used.

## contract validation plan

Not applicable; no public API or schema contract changes are made by this plan.

## replay and determinism plan

Not applicable; this plan does not change the Orders-events consumer or campaign execution logic.

## files to inspect

- README.md
- BUSINESS.md
- SYSTEM.md
- AGENTS.md
- AGENT_OPERATIONS.md
- TASKS.md
- STATE.json
- .env.example
- src/orders-events-consumer.ts

## files to create

- docs/00_constitution/CONSTITUTION.md
- docs/01_vision/VISION.md
- docs/06_architecture/INTEGRATION_CONTRACT.md
- docs/17_governance/PROJECT_INVARIANTS.md
- docs/11_tasks/TASK-001-bootstrap-service.md
- docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
- docs/21_execution_plans/EP-TASK-001-bootstrap-service.md
- docs/12_validation/VAL-TASK-001-bootstrap-service.md
- ips-adoption.json

## files to modify

- README.md
- BUSINESS.md
- SYSTEM.md
- AGENTS.md
- AGENT_OPERATIONS.md
- CLAUDE.md
- TASKS.md
- STATE.json
- docs/orchestrator/VALIDATION_DEBT.md

## files that must not be modified

- docs/orchestrator/ROADMAP.md (owned by the active goal-driven workstream)
- docs/agents/* contract files
- Any service source code under src/
- k8s manifests
- deploy.config.sh

## implementation steps

- Read all existing real content in root docs, TASKS.md, STATE.json, and .env.example
- Run the non-destructive scaffolder for any missing files
- Reformat every required artifact into validator-required sections using only observed facts
- Complete the integration review for all 16 capabilities, confirming actual code usage in src/
- Run the planning validator and fix all reported findings
- Commit directly to main in this repository only

## parallel execution

Single-owner sequential execution; no parallel lanes required for this documentation bootstrap.

## blockers

- None identified during this bootstrap; the pre-existing attribution-ownership and CRM/account-integration follow-ups remain open project blockers, not bootstrap blockers.

## test plan

- No code tests apply; validation is via the IPS adoption validator only.

## validation plan

Run the IPS adoption validator in the project root and confirm no unresolved findings: `python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning`. See `../12_validation/VAL-TASK-001-bootstrap-service.md` for recorded evidence.

## gate commands

- `python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning`

## documentation updates

- All files listed under files to create/modify above.

## rollback plan

Revert the single onboarding commit with `git revert` if any adoption artifact is found to misstate project facts; no runtime behavior is affected.

## handoff

Handoff evidence and traceability confirmation are recorded in `../12_validation/VAL-TASK-001-bootstrap-service.md`, which links back to `../11_tasks/TASK-001-bootstrap-service.md`.

## completion checklist

- Planning validator passes
- All protected docs carry approval evidence
- Commit made to main with descriptive message
- Final report delivered with files-changed count and commit hash
