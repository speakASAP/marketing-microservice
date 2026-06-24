# Marketing Hosted Auth Verification Plan

Date: 2026-06-24
Owner role: Marketing hosted Auth verification worker
Repo: `/home/ssf/Documents/Github/marketing-microservice`
Mode: remote-only source verification and small safe standards alignment

## IPS Chain

Vision: Alfares product/admin applications use Auth-hosted login and registration instead of app-local credential collection.

Goal Impact: Marketing admins enter through `https://auth.alfares.cz/login` or `https://auth.alfares.cz/register`, return to Marketing through a validated callback handoff, and keep campaign/recipient execution protected by existing service-token and Auth role boundaries.

System: `auth-microservice` owns hosted credential UI and `POST /auth/validate`; `marketing-microservice` owns public landing links, `/auth/login`, `/auth/register`, `/auth/callback`, admin shell session validation, and service-token protected write APIs.

Feature: Hosted Auth redirect/callback verification for Marketing admin entry.

Task: Verify current `/auth/login`, `/auth/register`, and `/auth/callback` against `HOSTED_AUTH_CONSUMER_STANDARD.md`; reconcile stale docs that still claim login/register is blocked; patch only small safe standards gaps.

Execution Plan: Inspect remote source and docs only; do not read secrets, `.env` values, Kubernetes Secret data, live DB data, or run deploys; preserve campaign execution, notification provider, recipient/contact export, service-token, DB/migration, and deploy/k8s files; run build, full test suite, focused API contract tests, static route scan, and diff whitespace check.

Coding Prompt: Keep Marketing as a consumer only. Login/register must redirect to Auth with `return_url`, `client_id`, and opaque `state`; callback must parse URL fragments, require the generated state cookie to match returned state, strip token fragments by redirecting to `/admin`, avoid refresh-token storage, and keep browser admin tokens separate from service-token protected write APIs.

Code: `src/main.ts` already provides `/auth/login`, `/auth/register`, and `/auth/callback`; this verification tightened `public/auth-callback.html` state handling and updated `test/api-contracts.test.ts` coverage. `src/admin-auth.ts` remains the server-side Auth `/auth/validate` guard.

Validation: see `docs/orchestrator/STATUS.md` entry dated 2026-06-24 after command execution.

## GDD Verification Plan

Goal: Marketing hosted Auth entry points are standards-compliant and documented as current, not blocked.

Definition of Done:

- `/auth/login` redirects to `https://auth.alfares.cz/login` with `return_url=https://marketing.alfares.cz/auth/callback`, `client_id=marketing-microservice`, and generated `state`.
- `/auth/register` redirects to `https://auth.alfares.cz/register` with the same callback/client/state contract.
- `/auth/callback` consumes fragment `access_token`, requires the generated `marketing_auth_state` cookie to match returned `state`, stores only the admin access-token cookie path, clears the temporary state cookie, and redirects to `/admin` so token fragments leave browser history.
- `src/admin-auth.ts` continues to validate browser admin sessions through Auth `/auth/validate` and role mapping.
- Protected write APIs continue to require service authorization and do not accept browser Auth sessions as service tokens.
- Historical docs that mention blocked login/register URLs are treated as superseded by later Goal 14/15 evidence and this verification note.

## Current Auth Surface

- Public static entry links: `public/index.html` links to `/auth/register`, `/auth/login`, `/admin`, and `/health`.
- Redirect routes: `src/main.ts` implements `GET /auth/login` and `GET /auth/register` with `AUTH_SERVICE_PUBLIC_URL` fallback `https://auth.alfares.cz`, `MARKETING_PUBLIC_URL` fallback `https://marketing.alfares.cz`, `client_id=marketing-microservice`, and a generated state cookie scoped to `/auth/callback`.
- Callback route: `src/main.ts` serves `public/auth-callback.html` and injects the configured admin auth cookie name.
- Callback browser handoff: `public/auth-callback.html` reads token data from `window.location.hash`, validates returned `state` against `marketing_auth_state`, stores only `access_token` in the configured admin cookie path, does not store `refresh_token`, clears temporary state, and redirects to `/admin`.
- Admin validation: `src/admin-auth.ts` extracts bearer/cookie tokens and validates them server-side with `POST /auth/validate` before applying Marketing viewer/operator/admin/owner roles.
- API write boundary: service-token protected Marketing write APIs remain in `src/api-contracts.ts` and are covered by API contract tests.

## Hosted Redirect And Callback State

Current state: implemented with one small standards alignment patch in this verification.

- Redirect state generation: present.
- `return_url`: present and absolute HTTPS by default.
- `client_id`: present as `marketing-microservice`.
- Callback fragment parsing: present.
- Callback state validation: now fails closed when the generated state cookie is missing or returned state differs.
- Fragment stripping: present through `window.location.replace("/admin")` after cookie handoff.
- Refresh token storage: not present.
- Live deployment parity: `[UNKNOWN: current deployed version versus source]`; deploys and live secret/config checks were forbidden in this task.

## Stale-Doc Reconciliation

`docs/orchestrator/STATUS.md` contains historical 2026-06-13 entries saying Goal 14.3/14.4 were blocked by missing auth URL, return URL, and admin route contracts. Later entries in the same file, `docs/orchestrator/GOALS.md`, and this plan supersede those historical blockers: Goal 14 is done, Goal 15 is done, and the current source contains hosted Auth login/register redirects plus callback handoff.

Do not treat the older blocked lines as current state unless a future verification proves source regression or deployment drift.

## Validation Evidence To Record

- `npm run build`
- `npm test`
- `npm test -- test/api-contracts.test.ts`
- Static scan: `rg -n "auth\.alfares\.cz|/auth/login|/auth/register|/auth/callback|return_url|client_id|marketing_auth_state|/auth/validate" src public test docs/orchestrator --glob "!node_modules/**" --glob "!dist/**"`
- `git diff --check -- public/auth-callback.html test/api-contracts.test.ts docs/orchestrator/2026-06-24-marketing-hosted-auth-verification-plan.md docs/orchestrator/STATUS.md`

## Blockers And Unknowns

- `[UNKNOWN: current deployed version versus source]` because deploys and live runtime verification were forbidden.
- `[MISSING: live admin callback/session smoke with safe token]` because reading secrets, token values, and live DB/runtime data was forbidden.
- `[MISSING: production Auth role grant evidence]` remains outside this task; no Auth role assignments or secrets were inspected.
