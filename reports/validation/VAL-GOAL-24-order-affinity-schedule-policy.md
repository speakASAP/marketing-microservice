# VAL-GOAL-24 Order Affinity Schedule Policy

Date: 2026-07-03
Repository: `/home/ssf/Documents/Github/marketing-microservice`
Branch/worktree: `/home/ssf/Documents/Github/codex-worktrees/marketing-goal24-runtime-report`

## IPS Chain

Vision -> recurring product-relation publishes must use purchase-history evidence without leaking customer, address, payment, provider, token, or raw order payload data.
Goal Impact -> Allegro affinity publish can run on a deterministic daily schedule with durable ledger evidence before Catalog mutation.
System -> Marketing owns schedule, aggregation, Catalog publish orchestration, and ledger evidence; Allegro owns replay source; Catalog owns persisted relation rows.
Feature -> `--schedule` CLI policy plus active `marketing-order-affinity-allegro-daily` and `marketing-order-affinity-central-orders-backfill` CronJobs.
Task -> add closed UTC windows, deterministic run IDs, explicit channel/source, UTC CronJob schedules, and a scheduled-publish ledger-required guard.
Execution Plan -> implement source/tests/manifest only, deploy active Allegro daily CronJob after validation, keep Aukro/Bazos unscheduled until producer contracts exist.
Coding Prompt -> never scheduled-publish without a successfully recorded ledger row; do not print secrets or raw payloads.
Code -> `src/order-affinity-schedule-policy.ts`, `src/order-affinity-backfill.ts`, `k8s/order-affinity-cronjob.yaml`, `scripts/deploy.sh`, focused tests.
Validation -> focused tests, build, diff check, Kubernetes server-side dry-runs, and live rollout/CronJob checks passed.
State Update -> active Allegro daily schedule deployed with explicit UTC timezone; non-Allegro marketplace schedules remain blocked.

## Behavior

- New CLI options: `--schedule daily|hourly`, `--schedule-at`, `--lookback`, and `--window-delay-minutes`.
- Scheduled windows are closed UTC windows. The Allegro daily CronJob runs at `02:23 UTC` with a 120 minute delay, so it publishes the previous closed UTC day.
- Scheduled run IDs include source, channel, cadence, and window bounds: `order-affinity:<sourceOwner>:<channel>:<schedule>:<from>:<to>`.
- Scheduled publish fails closed with `order_affinity_scheduled_publish_ledger_required` unless `recordOrderAffinityRunLedger` returns `recorded` before Catalog publish.
- The deployed Allegro CronJob schedules only Allegro: `sourceOwner=allegro-service`, `channel=allegro`, `--marketplace-url http://allegro-service.statex-apps.svc.cluster.local:3000`.
- Both active recurring CronJobs use `timeZone: Etc/UTC`, `concurrencyPolicy: Forbid`, `startingDeadlineSeconds: 1800`, and `activeDeadlineSeconds: 900`.

## Validation Evidence

- `git diff --check` passed.
- `npx tsx --test --test-concurrency=1 test/order-affinity-backfill.test.ts test/order-lifecycle-events.test.ts` passed: 25 tests, 25 pass.
- `npm run build` passed.
- `kubectl apply --dry-run=server -f k8s/order-affinity-cronjob.yaml -n statex-apps` passed.
- `kubectl apply --dry-run=server -f k8s/order-affinity-backfill-cronjob.yaml -n statex-apps` passed.
- Live rollout check passed for `deployment/marketing-microservice`.
- Live CronJob check passed for `marketing-order-affinity-allegro-daily` and `marketing-order-affinity-central-orders-backfill`.

## Privacy Boundary

Validation printed no customer, address, payment, provider, token values, raw marketplace order IDs, raw event payloads, or raw Catalog relation payloads.

## Blockers

- `[MISSING: Aukro order-affinity replay endpoint compatible with Marketing marketplace replay contract]`.
- `[MISSING: Bazos order-affinity replay endpoint compatible with Marketing marketplace replay contract]`.
- `[MISSING: Catalog source/window scoped stale-affinity pruning or replacement API]`.
