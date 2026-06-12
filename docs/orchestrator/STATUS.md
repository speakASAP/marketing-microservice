# Marketing Orchestrator Status

## 2026-06-12

Current focus: Goal 1 - Intent Preservation And Contract Baseline.

Evidence gathered:

- Remote repository path: `/home/ssf/Documents/Github/marketing-microservice`.
- Root intent files exist: `README.md`, `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, `STATE.json`, and `AGENTS.md`.
- `docs/agents`, `docs/agents/contracts`, and `docs/agents/prompts` directories existed but were empty.
- `README.md` referenced contract files under `docs/agents/contracts`, but those files were missing.
- Existing implementation is TypeScript/Express with campaign CRUD, segment CRUD, idempotent campaign execution, consent/unsubscribe/frequency-cap checks, notification delegation through `NOTIFICATION_SERVICE_URL`, and tests under `test/executor.test.ts`.
- Existing `package.json` verification commands: `npm run build`, `npm run check`, and `npm test`.

Implementation evidence:

- Added the Intent Preservation pack under `docs/orchestrator/`.
- Updated `AGENTS.md` to make the orchestrator pack mandatory for future implementation sessions.
- Backfilled compatibility docs under `docs/agents` for the README-referenced contract paths.
- Verified README-referenced compatibility contract paths now exist.
- Remote `npm run build` passed.
- Remote `npm test` passed: 6 tests, 6 passing.

Intent Compliance Report:

- Marketing remains the campaign and segmentation control plane.
- Direct outbound delivery remains owned by notifications-microservice.
- Registered-user contact and consent ownership remains in auth-microservice.
- Lead contact and consent ownership remains in leads-microservice.
- Orders/catalog are documented as segmentation signal sources, not campaign owners.
- Real campaign execution remains documented as requiring explicit owner approval.

Completed goal:

- Goal 1 - Intent Preservation And Contract Baseline.

Next unfinished step:

- Goal 2 - External Source Integration: replace runtime stub contacts with auth/leads clients while preserving auth/leads ownership of contact and consent data.
