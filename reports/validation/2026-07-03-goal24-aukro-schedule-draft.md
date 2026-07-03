# Goal 24 Aukro Schedule Draft Validation

Date: 2026-07-03
Owner role: Marketing Aukro schedule/integration worker

## IPS Chain

Vision -> Aukro marketplace purchase history can improve Catalog order-affinity relations without leaking buyer, address, payment, provider, token, credential, or raw marketplace payload data.
Goal Impact -> Marketing now has a reviewable, suspended Aukro recurring schedule draft ready for owner approval once Aukro has non-empty evidence.
System -> Aukro owns protected marketplace replay source; Marketing owns aggregation, scheduling, ledger evidence, and guarded Catalog publish orchestration; Catalog owns durable relation rows.
Feature -> Suspended source-only Aukro scheduled publish draft for `backfill:order-affinity`.
Task -> Prepare activation path without running live publish, deploying a new Marketing image, mutating Catalog, or changing active Allegro/central Orders schedules.
Execution Plan -> Convert the deploy-applied Aukro manifest section to a suspended draft, require `suspend: true`, and document activation blockers.
Coding Prompt -> Preserve scheduled publish ledger guard, separate Aukro from active schedules, and mark missing approvals/evidence explicitly.
Code -> `k8s/order-affinity-cronjob.yaml`, contract/status/report docs.
Validation -> `kubectl apply --dry-run=server`, active CronJob readback, and `git diff --check`.
State Update -> Aukro schedule is dependency-gated and suspended.

## Draft Manifest

- `marketing-order-affinity-aukro-daily` is `suspend: true` in `k8s/order-affinity-cronjob.yaml`.
- `scripts/deploy.sh` applies `k8s/order-affinity-cronjob.yaml`, so the manifest must remain suspended until explicit owner approval changes it.
- Schedule is `04:23 UTC`, avoiding the active Allegro `02:23 UTC` and central Orders `03:20 UTC` windows.
- Runtime args keep `--publish` behind `--record-ledger`, `--schedule daily`, `--window-delay-minutes 120`, `--source-owner aukro-service`, and `--channel aukro`.

## Activation Blockers

- `[MISSING: non-empty Aukro multi-Catalog-product replay evidence]`
- `[MISSING: owner-approved Aukro source/window recurring schedule activation policy]`
- Catalog source/window scoped replacement API is verified in Catalog: `POST /api/internal/product-relations/order-affinity/replace-window`; Aukro activation still requires Marketing complete-snapshot ledger proof and producer completeness.

## Validation Commands

```bash
kubectl -n statex-apps apply --dry-run=server -f k8s/order-affinity-cronjob.yaml
kubectl -n statex-apps get cronjob -o custom-columns=NAME:.metadata.name,SCHEDULE:.spec.schedule,TZ:.spec.timeZone,SUSPEND:.spec.suspend,ACTIVE:.status.active[*].name,LAST:.status.lastScheduleTime | rg "marketing-order-affinity|NAME"
git diff --check
```

## Validation Results

- `kubectl -n statex-apps apply --dry-run=server -f k8s/order-affinity-cronjob.yaml` passed: Allegro was unchanged and Aukro would be configured as a suspended CronJob.
- Live CronJob readback found an existing active `marketing-order-affinity-aukro-daily` at `02:43 UTC`; it was patched to `suspend: true` as a safety action to prevent unintended scheduled publish.
- Final live CronJob readback showed Allegro active at `02:23 UTC`, central Orders active at `03:20 UTC`, and Aukro suspended.
- `git diff --check` passed.

## Safety Boundary

No deploy, live `--publish`, Catalog mutation, secret value output, raw replay data output, Allegro behavior change, or central Orders behavior change was performed. The only runtime mutation was suspending the already-existing active Aukro CronJob to prevent an unintended scheduled publish.
