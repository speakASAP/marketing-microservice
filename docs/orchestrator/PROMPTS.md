# Marketing Goal Prompts

Use these prompts when the owner asks to "implement the next marketing goal."

## Universal Session Prompt

Read `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, and `STATUS.md`. Identify the earliest active or pending chunk. Restate the preserved marketing intent and the ownership boundaries affected by the chunk. Implement only that chunk, verify it, append status evidence, and leave the next chunk clearly named.

## Goal 1 Prompt

Implement the next unfinished chunk of "Goal 1 - Intent Preservation And Contract Baseline." Preserve existing root documentation and create or correct only documentation needed for the Intent Preservation system.

## Goal 2 Prompt

Implement the next unfinished chunk of "Goal 2 - External Source Integration." Replace runtime stub contacts with auth/leads clients while keeping contact and consent ownership in auth/leads. Do not implement direct delivery.

## Goal 3 Prompt

Implement the next unfinished chunk of "Goal 3 - Persistence And Execution State." Move campaign, segment, run, outcome, and idempotency state to PostgreSQL without weakening execution safety.

## Goal 4 Prompt

Implement the next unfinished chunk of "Goal 4 - Campaign Approval And Safety Gates." Ensure real campaign execution requires explicit owner approval and dry-run remains delivery-free.

## Goal 5 Prompt

Implement the next unfinished chunk of "Goal 5 - Scheduling, Throttling, And Frequency Controls." Preserve recipient safety, idempotency, and duplicate-send prevention.

## Goal 6 Prompt

Implement the next unfinished chunk of "Goal 6 - Audit Logging And Compliance Evidence." Add structured audit evidence without logging secrets or sensitive message credentials.

## Goal 7 Prompt

Implement the next unfinished chunk of "Goal 7 - API Contract Hardening." Stabilize validation and authorization contracts for consumers without changing ownership boundaries.

