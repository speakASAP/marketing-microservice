# Marketing Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

## Goal 1 - Intent Preservation And Contract Baseline

Status: done

Intent: Marketing must preserve its role as the campaign orchestration service before further implementation.

Chunks:

- [x] 1.1 Create marketing-local intent preservation docs and master prompt.
- [x] 1.2 Update `AGENTS.md` to require the orchestrator pack.
- [x] 1.3 Backfill referenced contract docs under `docs/agents/contracts`.
- [x] 1.4 Confirm README references are satisfied by the restored compatibility docs.

Acceptance criteria:

- `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, and `PROMPTS.md` exist.
- `AGENTS.md` tells future agents to follow the orchestrator pack before implementation.
- Existing root intent files remain preserved.
- Stale documentation references are either created or corrected.

## Goal 2 - External Source Integration

Status: active

Intent: Marketing segment execution must use real auth/leads data instead of in-memory stub contacts.

Chunks:

- Add auth users client for registered-user contact, preferences, and consent.
- Add leads client for lead contact, preferences, and consent.
- Add order/catalog signal client only where segment rules require it.
- Preserve in-memory test fixtures behind tests only.

Acceptance criteria:

- Runtime execution no longer depends on hardcoded contact fixtures.
- Consent and unsubscribe checks use source-owned data.
- API failures produce safe skips or failed runs without direct sending.
- `npm run build` and `npm test` pass.

## Goal 3 - Persistence And Execution State

Status: pending

Intent: Campaigns, segments, runs, delivery outcomes, and suppression evidence must survive process restarts.

Chunks:

- Add PostgreSQL schema/migrations for segments, campaigns, runs, outcomes, suppression, and idempotency keys.
- Replace in-memory maps with repository interfaces backed by PostgreSQL.
- Preserve test reset helpers using isolated test stores or database fixtures.

Acceptance criteria:

- Campaign CRUD and execution state persist across restarts.
- Idempotency works across restarts.
- Delivery outcomes include consent, skip, failure, and sent evidence.
- `npm run build` and `npm test` pass.

## Goal 4 - Campaign Approval And Safety Gates

Status: pending

Intent: Real campaign execution must require explicit owner approval and safe operational limits.

Chunks:

- Add campaign approval state and approval actor metadata.
- Require approval for scheduled or manual execution against real recipients.
- Add dry-run mode that resolves recipients and decisions without delivery.
- Enforce max sends per run and max chunk size with clear errors.

Acceptance criteria:

- Draft or unapproved campaigns cannot execute against real recipients.
- Dry-run produces recipient counts, skip reasons, and channel decisions without notification calls.
- Real execution records approval evidence.
- `npm run build` and `npm test` pass.

## Goal 5 - Scheduling, Throttling, And Frequency Controls

Status: pending

Intent: Scheduled and recurring campaigns must run predictably while protecting recipients.

Chunks:

- Add scheduler ownership and locking rules.
- Implement per-campaign throttle and frequency-cap persistence.
- Add recurring campaign model if explicitly required by owner.
- Add operational visibility for pending, running, completed, failed, and paused runs.

Acceptance criteria:

- Duplicate schedulers cannot double-send the same run.
- Frequency caps are enforced across persisted history.
- Paused campaigns do not execute.
- `npm run build` and `npm test` pass.

## Goal 6 - Audit Logging And Compliance Evidence

Status: pending

Intent: Marketing must produce audit-grade evidence for campaign and recipient decisions.

Chunks:

- Send structured logs to logging-microservice where available.
- Add audit fields for campaign create/update/approval/execution.
- Record unsubscribe and consent-decision evidence without exposing secrets.
- Add correlation IDs for cross-service notification calls.

Acceptance criteria:

- Logs include ISO timestamp and `duration_ms` where relevant.
- Campaign execution can explain every sent, skipped, or failed recipient.
- No sensitive tokens or message secrets are logged.
- `npm run build` and `npm test` pass.

## Goal 7 - API Contract Hardening

Status: pending

Intent: Marketing APIs must be stable enough for Statex applications and service-to-service consumers.

Chunks:

- Define request/response contracts for campaigns, segments, executions, dry runs, and preferences/unsubscribe.
- Add validation for required fields, channel names, purposes, and schedule values.
- Add service auth/RBAC boundary for writes and execution.
- Add contract tests or smoke scripts.

Acceptance criteria:

- Invalid campaign, segment, and execution requests fail with stable errors.
- Protected operations require service/user authorization.
- Public unsubscribe/preference endpoints follow documented contract.
- `npm run build` and `npm test` pass.
