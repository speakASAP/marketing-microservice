# Production Readiness Operations Playbook

## Scope

This playbook supports Goal 20 production governance for marketing campaigns and journeys. It is documentation-first and does not authorize deployment or real recipient execution. Real campaigns still require explicit owner approval, source-owned consent, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 notification chunking, registry validation, and notification delegation.

## Pre-Execution Checklist

- Confirm campaign ID, tenant/app/brand scope, purpose, channel strategy, template reference, and risk class.
- Confirm latest dry-run summary was reviewed after the latest material campaign, segment, journey, or policy change.
- Confirm campaign approval evidence exists and is current.
- For high-risk or restricted campaigns, confirm two-person or exception approval evidence.
- Confirm recipient count is within owner-approved max-send limits.
- Confirm consent, unsubscribe, frequency-cap, throttling, idempotency, and max-30 controls are enabled.
- Confirm quiet-hour and tenant/app policy result is pass or has an owner-approved exception.
- Confirm notifications-microservice is the only delivery path.
- Confirm rollback owner, incident owner, and unsubscribe escalation owner for this run.

## Deployment Checklist

Deployment requires explicit owner approval before running `./scripts/deploy.sh`.

- Review diff for runtime delivery, consent, approval, scheduler, and notification delegation changes.
- Run `npm run build` and `npm test` for code changes.
- Confirm no service tokens, provider credentials, message secrets, authorization headers, or recipient addresses are added to logs or docs.
- Confirm environment variable names are documented in `.env.example` when runtime config changes.
- Confirm Kubernetes/runtime changes are owner-approved.
- Confirm post-deploy health check target and rollback command are known.

Deployment command after approval:

```bash
ssh alfares "cd /home/ssf/Documents/Github/marketing-microservice && ./scripts/deploy.sh"
```

## Rollback Checklist

Rollback procedure requires owner-approved deployment history and may depend on the current Kubernetes/image workflow.

- Stop or pause affected scheduled campaigns/journeys where possible before rollback.
- Preserve run IDs, campaign IDs, correlation IDs, idempotency keys, timestamps, and deployment version evidence.
- Roll back the deployment using the owner-approved production procedure: [MISSING: confirmed rollback command/version policy].
- Verify `GET /health` and inspect Kubernetes logs after rollback.
- Confirm scheduler does not replay already completed idempotent runs.
- Record impact summary and follow-up tasks in orchestrator status or incident record.

## Incident Review Checklist

Use this for suspected duplicate sends, consent failures, unsubscribe misses, wrong audience, quiet-hour breach, delivery delegation failure, or provider-level failures reported through notifications.

- Capture incident start time, reporter, campaign ID, run ID, journey ID/step ID if applicable, tenant/app/brand, channel, and correlation IDs.
- Pause affected campaigns/journeys if real recipient risk continues.
- Verify whether notifications was the only delivery path.
- Compare dry-run evidence with real execution outcomes.
- Check approval, risk class, policy guardrail, consent, unsubscribe, frequency-cap, throttle, idempotency, max-send, and max-30 evidence.
- For provider errors, coordinate with notifications-microservice owner; Marketing must not patch provider credentials or provider send behavior.
- For contact, consent, or unsubscribe data issues, coordinate with auth/leads owner; Marketing must not create replacement source truth.
- Record root cause, affected count, remedial action, and prevention task.

## Unsubscribe Escalation Checklist

Operational systems must honor unsubscribe requests within 24 hours. Marketing may accept unsubscribe intake but auth/leads remain durable preference owners.

- Capture unsubscribe request ID, owner (`auth` or `leads`), recipient ID, tenant/app/brand scope if present, channel/purpose if present, and timestamp.
- If source write succeeds, verify the source owner will return unsubscribe state through recipient resolution.
- If source write is pending or failed, escalate to the auth/leads owner immediately with sanitized evidence.
- Do not create Marketing-owned durable unsubscribe truth as a replacement for auth/leads.
- Until the source-owned unsubscribe state is visible, avoid real execution for affected campaign/scope when risk cannot be bounded.
- Confirm resolution within 24 hours or escalate as an incident.

## Parallel Execution Notes

Ready now:

- Governance/readiness docs and playbooks.
- Policy contract review.

Dependency-gated:

- Enforcement code waits for confirmed thresholds, approver identity sources, quiet-hour defaults, and owner-approved rollback procedure.
- Admin governance UI waits for Goal 15 admin auth/RBAC and Goal 16/17 protected operational views.
- Journey governance enforcement waits for stable Goal 13 runtime and dry-run/audit evidence.

Final integration:

- Integration owner should merge policy fields into campaign/journey contracts after owner confirms missing decisions.
- Validation owner should run build/tests once enforcement code or generated docs are added.
- Merge order: policy approval, contract update, backend enforcement, admin UI exposure, production deployment approval.
