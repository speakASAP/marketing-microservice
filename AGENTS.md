# Agents: marketing-microservice

Marketing is a campaign orchestration service, but AI/Codex sessions must follow the marketing implementation orchestrator before planning or implementing work.

## Knowledge Retrieval

When available, query docs-rag-microservice for ecosystem architecture, config, API, migration, deployment, and operations context. This does not replace the mandatory marketing reading order below.

```bash
kubectl -n statex-apps exec deployment/marketing-microservice -- node -e '
const fs = require("fs");
const token = fs.readFileSync(process.env.HOME + "/.claude/rag-token", "utf8").trim();
fetch("http://docs-rag-microservice:3397/retrieval/agent-context", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  body: JSON.stringify({ query: "YOUR QUESTION HERE", maxTokens: 3000 }),
}).then(async (r) => { console.log(await r.text()); process.exit(r.ok ? 0 : 1); });
'
```

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
3. Restate the preserved marketing intent and affected ownership boundaries.
4. Implement only the next valid goal chunk unless the owner explicitly selects another.
5. Keep write ownership disjoint when using workers or subagents.
6. Update `docs/orchestrator/STATUS.md` after every implementation session.
7. Require an Intent Compliance Report before marking a goal complete.
8. Run or document validation before moving to the next goal.
9. Never broaden marketing into direct delivery, identity ownership, contact ownership, or order/catalog ownership.
10. Never execute a campaign against real recipients without explicit owner approval.

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
