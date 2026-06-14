# Production Governance And Readiness Contract

## Owner

Marketing-microservice owns campaign risk classification, approval evidence, execution readiness checks, policy references, operational audit state, and production run governance. Notifications-microservice remains the outbound provider executor. Auth and leads remain the sources of identity, contact data, consent, preferences, and unsubscribe truth. Tenant/app policy truth remains in the tenant/app/business registry or an explicitly approved policy source.

## Intent Preservation Chain

- Vision: Statex applications can run production campaigns through one audited control plane without duplicating delivery, consent, or campaign governance.
- Goal Impact: Goal 20 adds production readiness policy before broad real campaign operations.
- System: Marketing classifies campaign risk, records approvals, validates policy guardrails, and provides operational playbooks.
- Feature: Risk classes, approval workflow design, quiet-hour and tenant/app policy guardrails, deployment/rollback/incident/unsubscribe checklists.
- Task: Document the governance contract before enforcement code.
- Execution Plan: Keep this draft documentation-only until owner confirms thresholds, approvers, quiet-hour defaults, and deployment/rollback procedure.
- Coding Prompt: Future enforcement must reuse campaign execution and journey execution safety gates instead of adding direct delivery paths.
- Code: [MISSING: enforcement implementation is intentionally blocked pending policy confirmation and admin auth foundations].
- Validation: Documentation review against `GOALS.md`, `PLAN.md`, and existing campaign, consent, channel, and integration contracts.

## Risk Classification

Risk classification is Marketing-owned execution governance metadata. It must never replace consent checks, unsubscribe enforcement, frequency caps, throttling, idempotency, max-send limits, max-30 chunking, registry validation, or notification delegation.

| Class | Default meaning | Examples | Minimum approval design | Required evidence |
| --- | --- | --- | --- | --- |
| `low` | Routine, low-volume, low-impact campaign to explicitly opted-in recipients. | Small lifecycle education, product tips, opt-in newsletter. | One owner approval. | Campaign approval actor, dry-run summary, policy check result. |
| `standard` | Normal production campaign with meaningful recipient volume or commercial impact. | Retention, post-purchase, activation, reactivation. | One owner approval plus operator confirmation at real execution time. | Approval actor, dry-run summary, max-send cap, frequency-cap result, consent/unsubscribe skip summary. |
| `high` | Campaign with elevated legal, reputational, financial, or recipient-experience risk. | Winback at scale, cross-sell/upsell, sensitive lifecycle stage, unusual channel mix, broad multi-app audience. | Two-person approval: business owner and governance/operations approver. | Both approvers, dry-run export/checksum, recipient count bands, quiet-hour policy result, rollback plan link. |
| `restricted` | Campaign that must not execute until a human owner explicitly authorizes an exception. | Legal/compliance-sensitive content, unclear consent lineage, new tenant/app policy, emergency broadcast. | Explicit owner exception plus governance/operations approval. | Exception reason, expiry, approver identities, incident channel, post-run review requirement. |

Required future fields, subject to contract approval: `riskClass`, `riskReasons[]`, `riskClassifiedBy`, `riskClassifiedAt`, `riskPolicyRef`, `highRiskApprovalStatus`, `highRiskApprovers[]`, and `realExecutionConfirmedBy`.

Blocked decisions before code enforcement:

- [MISSING: production recipient-count thresholds for low, standard, high, and restricted classes]
- [MISSING: high-risk business approver identity source]
- [MISSING: governance/operations approver identity source]
- [MISSING: policy owner for restricted campaign exceptions]

## Approval Workflow Design

Production real execution must preserve the existing campaign approval contract and add readiness gates without weakening it.

1. Campaign is created as draft with `approvalStatus: pending`.
2. Operator runs dry-run preview; dry-run must not call notifications or record sent history.
3. Marketing assigns or records risk class and reasons.
4. Standard campaign approval records owner evidence through the existing approval path.
5. High-risk or restricted campaigns require stronger review before real execution confirmation.
6. Real execution confirmation records the confirming actor, timestamp, risk class, dry-run reference, max-send cap, and rollback/playbook acknowledgement.
7. Scheduler and journey executions must only execute campaigns whose approval and policy gates are satisfied at execution time.

Approval separation rules:

- The same actor may not satisfy both high-risk business approval and governance/operations approval unless owner explicitly allows an emergency exception.
- AI/Codex sessions, tests, and automation must not be approvers for real recipient execution.
- A blueprint, catalog entry, journey definition, or active journey is never sufficient approval for real campaign delivery.
- Journey approval does not replace campaign approval; journey steps must still reuse campaign execution gates.

## Quiet-Hour And Tenant/App Policy Guardrails

Policy guardrails are proposed as references first. Marketing stores policy references and execution evidence, not tenant/app policy truth.

Recommended policy inputs:

- Tenant/app timezone from the tenant/app/business registry.
- Optional recipient timezone from auth/leads when provided by source-owned recipient resolution.
- Tenant/app `policyRef` from the registry.
- Campaign purpose, channel, risk class, lifecycle stage, and scheduled time.

Proposed guardrails:

- Do not start marketing-purpose delivery during quiet hours for the applicable tenant/app or recipient timezone.
- If recipient timezone is unknown, fall back to tenant/app timezone; if tenant/app timezone is missing, block real execution until policy is confirmed.
- Transactional-not-marketing campaigns may use separate policy but still must not bypass unsubscribe/legal constraints unless owner-approved and documented.
- Policy outages fail safely before notification delegation for real execution.
- Dry-run should report policy skips and blocked execution windows without sending.

Default quiet-hour proposal pending owner confirmation:

- Local quiet hours: 21:00-08:00.
- Weekend/holiday restrictions: [MISSING: tenant/app defaults].
- Channel-specific quiet hours: [MISSING: email/telegram/whatsapp defaults].
- Emergency override policy: [MISSING: approver and expiry rules].

## Production Readiness Checklist

A campaign or journey-controlled campaign is production-ready only when all items are true:

- Campaign has explicit owner approval evidence.
- High-risk or restricted campaign has required stronger approval evidence.
- Dry-run summary exists and was reviewed after the latest material campaign, segment, journey, or policy change.
- Tenant/app/brand registry scope validates successfully.
- Recipient consent and unsubscribe checks are source-owned through auth/leads.
- Frequency caps, throttling, max-send, idempotency, and max-30 chunking remain configured.
- Notifications configuration is delegated through notifications-microservice and no provider credentials are stored in Marketing.
- Quiet-hour/policy guardrail result is pass or documented owner exception.
- Rollback and incident owner are known before execution.
- Unsubscribe escalation path is ready and honors the 24-hour operational requirement.

## Future Enforcement Boundaries

Enforcement code must wait until journey runtime and admin auth/RBAC foundations are stable. Future code must not edit notification provider behavior, auth/leads source-of-truth models, or contact ownership. Admin UI work may display and request governance evidence only after Goal 15 protects browser admin routes server-side.
