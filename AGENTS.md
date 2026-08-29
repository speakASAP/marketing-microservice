# Repository Agent Instructions

Shared rules live here:

- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# Agents: marketing-microservice

Marketing is a campaign orchestration service, but AI/Codex sessions must follow the marketing implementation orchestrator before planning or implementing work.

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

## One-Command Continuation

When the user says:

```text
MARKETING ORCHESTRATOR: continue implementation
```

or:

```text
Continue implementation of this project.
```

act as the marketing implementation orchestrator.

Do not ask the user which goal is next. Determine the next action from:

```text
docs/orchestrator/GOALS.md
docs/orchestrator/PLAN.md
docs/orchestrator/STATUS.md
TASKS.md
STATE.json
```

Then continue from the latest checkpoint.

## Mandatory Reading Order

Before implementation, branch orchestration, deployment, or launching workers, read:

1. `BUSINESS.md`
2. `SYSTEM.md`
3. `README.md`
4. `TASKS.md`
5. `STATE.json`
6. `docs/orchestrator/MASTER_PROMPT.md`
7. `docs/orchestrator/INTENT.md`
8. `docs/orchestrator/GOALS.md`
9. `docs/orchestrator/PLAN.md`
10. `docs/orchestrator/STATUS.md`
11. `docs/orchestrator/PROMPTS.md`
12. `docs/agents/contracts/integration-api-matrix.md`
13. `docs/agents/contracts/marketing-campaign-contract.md`
14. `docs/agents/contracts/preferences-consent-contract.md`
15. `docs/agents/contracts/channel-registry-contract.md`

## Parallel Planning Default

Codex planning for this repository must maximize safe parallel agent execution. Before assigning work, identify independently startable goals/chunks, explicit blockers, allowed and forbidden files per agent, expected outputs, validation commands, and merge/integration order.

Keep work serial only when chunks touch the same files, migrations, public contracts, route namespaces, DTO/schema definitions, generated artifacts, or when one chunk depends on another chunk's runtime behavior or security foundation. If a dependency is unclear, mark the exact blocker instead of inventing a contract.

## Core Intent

```text
Marketing-microservice is the Statex campaign and segmentation control plane.
It owns campaign definitions, segment definitions, execution runs, delivery decisions, consent enforcement, frequency caps, throttling policy, and campaign audit state.
It must let Statex applications run email, Telegram, and WhatsApp campaigns without duplicating delivery logic or contact ownership.
Notifications-microservice owns outbound provider execution and channel registry behavior.
Auth-microservice owns registered-user identity, contact data, preferred channels, and registered-user consent/preferences.
Leads-microservice owns lead identity, contact data, preferred channels, and lead consent/preferences.
Orders/catalog and other domain services may contribute segmentation signals but must not become campaign engines.
Marketing must never send messages directly.
Marketing campaigns must never run without explicit owner approval and explicit recipient consent.
Unsubscribe and frequency-cap decisions must be enforced before delivery.
```

## Orchestrator Duties

1. Read the mandatory files in order before changing code or docs.
2. Identify the active goal, next ready goal, or blocked checkpoint.
3. Create or refresh a parallel execution assessment before implementation or worker assignment.
4. Prefer parallel agents for independent goals/chunks, with disjoint write ownership and explicit integration order.
5. Restate the preserved marketing intent and affected ownership boundaries.
6. Implement only the assigned valid goal chunk unless the owner explicitly selects another.
7. Keep write ownership disjoint when using workers or subagents.
8. Update `docs/orchestrator/STATUS.md` after every implementation session.
9. Require an Intent Compliance Report before marking a goal complete.
10. Run or document validation before moving to the next goal.
11. Never broaden marketing into direct delivery, identity ownership, contact ownership, or order/catalog ownership.
12. Never execute a campaign against real recipients without explicit owner approval.

## User Checkpoints

The user should only need to review:

```text
goal completion reports
validation summaries
contract or ownership boundary changes
production deployment approval
real campaign execution approval
```

Ask the user only when a decision cannot be safely inferred from the docs and current repository state.

## Active Agents

<!-- Coordinator-maintained -->
None.
