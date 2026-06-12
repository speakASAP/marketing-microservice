# Marketing Orchestrator Master Prompt

You are working on `marketing-microservice`, the Statex campaign and segmentation control plane.

## Preserved Intent

Marketing exists to define audiences, manage campaigns, schedule or execute approved campaign runs, enforce consent and frequency rules, select delivery channels, and record delivery outcomes. It lets applications such as FlipFlop, SpeakASAP, Statex, beauty, and future consumers use shared campaign capability without reimplementing delivery, consent, or segmentation logic.

## Non-Negotiable Boundaries

- Marketing owns campaign definitions, segment definitions, execution runs, delivery decisions, consent enforcement, frequency caps, throttling policy, and campaign audit state.
- Notifications owns outbound provider execution, provider credentials, and channel registry behavior.
- Auth owns registered-user identity, contact data, preferred channels, and registered-user consent/preferences.
- Leads owns lead identity, contact data, preferred channels, and lead consent/preferences.
- Orders/catalog and other domain services may provide segmentation signals, but they do not own campaigns.
- Marketing must never send email, Telegram, or WhatsApp messages directly.
- Marketing must never execute real campaigns without explicit owner approval.
- Marketing messages must only target recipients with explicit permission for the selected purpose.
- Unsubscribe decisions must be honored immediately in execution logic and within 24 hours operationally.
- Recipient batches must stay at or below 30 outbound notification calls per chunk unless the owner changes the platform rule.
- Runtime configuration belongs in environment variables and Kubernetes/Vault, not hardcoded source values.

## Required Workflow For Every Session

1. Read `BUSINESS.md`, `SYSTEM.md`, `README.md`, `TASKS.md`, `STATE.json`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/GOALS.md`, and `docs/orchestrator/PLAN.md`.
2. Identify the earliest unfinished goal in `docs/orchestrator/GOALS.md` unless the owner explicitly selects another goal.
3. Restate the exact preserved intent and ownership boundary affected by the goal.
4. Implement the smallest complete chunk that satisfies the selected goal's acceptance criteria.
5. Run the goal's verification commands or document why they could not run.
6. Append evidence to `docs/orchestrator/STATUS.md`.
7. Do not broaden the goal, silently change intent, or move work into another service unless the goal explicitly requires a contract boundary.

## Completion Standard

A goal is complete only when:

- Its acceptance criteria are met by code, docs, tests, or explicit runtime evidence.
- The evidence is recorded in `docs/orchestrator/STATUS.md`.
- `npm run build` passes for code changes.
- `npm test` passes or the exact limitation is recorded.
- Any changed protected behavior has unit tests, direct API verification, or an explicit manual verification note.
- The next goal remains clear and smaller than one Codex session.

