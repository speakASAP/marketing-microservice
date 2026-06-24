# AOS Hosted Auth Static Inventory: marketing-microservice

Date: 2026-06-24
Worker role: parallel Alfares Auth modernization inventory worker
Scope: static source/docs inspection only; no secrets, env values, live DB rows, production logs, deploys, backfills, or smokes.
Central standard: `/home/ssf/Documents/Github/auth-microservice/docs/HOSTED_AUTH_CONSUMER_STANDARD.md`

## IPS Chain

- Vision: Marketing operators use Auth-hosted human login while marketing delivery and machine integrations remain separately authorized.
- Goal Impact: centralize human credential/session validation without weakening campaign, preference, recipient, or production-governance boundaries.
- System: `auth-microservice`, Marketing Express routes, `public/auth-callback.html`, admin Auth validation middleware, and service-token protected operational APIs.
- Feature: hosted Auth login/register entry points, admin callback handoff, Auth-validated admin sessions, and separate machine-token paths.
- Task: inventory static auth surfaces and complete the bounded callback-fragment hardening slice against the hosted Auth consumer standard.
- Execution Plan: inspect source/docs with static grep only; harden the hosted Auth callback without changing service-token runtime logic; add static/test regression coverage; document workstreams and blockers.
- Coding Prompt: future workers must not read secrets, env values, live data, production logs, deploy, backfill, or touch legacy `speakasap-portal`.
- Code: `public/auth-callback.html` now strips the URL fragment with `history.replaceState` before cookie storage and redirect; `scripts/check-hosted-auth-static.mjs`, `package.json`, and `test/api-contracts.test.ts` cover hosted Auth redirect/callback markers.
- Validation: `npm run check:auth-static`; `npm test -- test/api-contracts.test.ts`; `git diff --check -- public/auth-callback.html test/api-contracts.test.ts scripts/check-hosted-auth-static.mjs package.json docs/orchestrator/2026-06-24-aos-auth-static-inventory.md`.

## Auth Surfaces Found

- Public entry points: `public/index.html` links to `/auth/register` and `/auth/login`.
- Auth redirect routes: `src/main.ts` implements `/auth/login` and `/auth/register`; each redirects to Auth-hosted `/login` or `/register` with `client_id=marketing-microservice`, `return_url=https://marketing.alfares.cz/auth/callback` by default, and a state cookie scoped to `/auth/callback`.
- Callback route: `src/main.ts` serves `/auth/callback` from `public/auth-callback.html`, substituting the configured admin access-token cookie name.
- Callback behavior: `public/auth-callback.html` parses `window.location.hash`, requires `access_token`, validates the returned state against `marketing_auth_state`, clears the state cookie, stores the access token in an admin-scoped cookie, and redirects to `/admin`.
- Fragment stripping: callback parses the hash into memory, immediately calls `history.replaceState(null, document.title, window.location.pathname + window.location.search)` when a fragment is present, then validates state, stores the admin cookie, and redirects to `/admin`.
- Admin token validation: `src/admin-auth.ts` accepts bearer tokens or the configured admin cookie, calls Auth `/auth/validate`, maps Auth roles to Marketing access levels, and returns 401/403/503 as appropriate.
- Protected admin surfaces: `src/main.ts` wraps admin pages and admin APIs with `requireAdminAuth` using viewer/operator/admin access levels.
- Service-token boundaries: `src/api-contracts.ts`, `src/registry.ts`, `src/sources.ts`, `src/preferences.ts`, `src/logger.ts`, `src/executor.ts`, and notification/channel integrations use bearer service tokens for machine-to-machine operations. These are separate from human hosted login and must not be collapsed into user Auth migration.
- Tests: `test/api-contracts.test.ts` verifies `/auth/login`, `/auth/register`, state cookie behavior, Auth redirect parameters, callback page markers, and admin Auth validation paths with synthetic tokens.

## Comparison To Hosted Auth Consumer Standard

- Compliant: human login/register entry points delegate to Auth-hosted UI with `client_id`, HTTPS callback return URL, and state.
- Compliant: callback reads token data from URL fragment and validates returned state before storing a local session artifact.
- Partially compliant: callback stores the access token in a browser-writable admin cookie; the standard prefers HTTP-only Secure SameSite cookies through a BFF/server route.
- Compliant for this slice: callback explicitly strips the fragment with `history.replaceState` before storing the admin cookie or redirecting to `/admin`; browser-history behavior remains a candidate for future browser-level verification.
- Compliant backend pattern: admin session validation calls Auth `/auth/validate` and preserves Auth role strings through role mapping.
- Separate boundary: local service tokens for campaign execution, registry, source, notification, logging, CRM, order, and lead calls are machine-token paths, not hosted human login blockers.
- Needs verification: runtime redirect allowlist and cookie security posture are `[MISSING: verified runtime config evidence]`; no secrets or live config were read.

## Completed Slice Evidence: Callback Fragment Hardening

- Scope completed: hosted Auth callback fragment handling only; no service-token runtime logic, campaign/provider code, deploy scripts, env/secret files, DB migrations, live data, production logs, or deploys were touched.
- Callback behavior change: `public/auth-callback.html` now copies `window.location.hash` into `rawFragment`, builds `URLSearchParams` from that in-memory value, and strips the visible URL with `history.replaceState` before reading/storing the access token or redirecting.
- Regression coverage: `test/api-contracts.test.ts` asserts the callback contains the `history.replaceState` marker before cookie storage and `/admin` redirect; `scripts/check-hosted-auth-static.mjs` fails if hosted Auth login/register/callback markers or callback ordering regress.
- Token hygiene: the checker validates static markers only and prints no token values; tests use synthetic tokens and do not print hosted Auth fragments.
- Validation evidence: `npm run check:auth-static` passed with `Hosted Auth static markers passed`; `npm test -- test/api-contracts.test.ts` passed `73/73` in the current repo script configuration; `git diff --check -- public/auth-callback.html test/api-contracts.test.ts scripts/check-hosted-auth-static.mjs package.json docs/orchestrator/2026-06-24-aos-auth-static-inventory.md` passed with no output.

## Implementation-Ready Workstreams

| Workstream | Status | Owner role | Scope | Forbidden files | Expected output | Dependencies | Validation evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Callback hardening | completed for fragment stripping | Marketing frontend/server auth worker | `public/auth-callback.html`, `test/api-contracts.test.ts`, `scripts/check-hosted-auth-static.mjs`, `package.json`, this inventory | env/secret files, deploy files, live logs, service-token runtime logic | explicit fragment stripping before storage/redirect plus static/test marker coverage | none | `npm run check:auth-static`; `npm test -- test/api-contracts.test.ts`; `git diff --check -- ...` |
| B. HTTP-only admin session adapter | dependency-gated | Marketing server auth worker | server callback/session route design and admin middleware | service-token redesign, campaign contracts, DB migrations | move browser-writable admin token cookie to server-owned HTTP-only session if approved | `[MISSING: approved admin session storage contract]` | Auth callback tests, 401/403 tests |
| C. Role mapping verification | ready now | Marketing API validation worker | `src/admin-auth.ts`, admin route matrix, tests | raw user data, live Auth tokens | verify viewer/operator/admin/owner role mapping against Auth role contract | `[MISSING: approved Auth role registry source]` | mocked Auth validation tests only |
| D. Machine-token boundary documentation | ready now | Integration boundary worker | service-token call sites in source/docs | secret values and runtime env output | document machine-token paths as separate from hosted human login | none | static call-site list, no secret values |

## Blockers And Unknowns

- [MISSING: verified Auth runtime redirect allowlist entry for `marketing-microservice`].
- [MISSING: approved admin session storage contract for HTTP-only server-owned cookies].
- [UNKNOWN: whether current browser-writable admin cookie is accepted transitional debt].
- [MISSING: authoritative Auth role registry for Marketing viewer/operator/admin/owner roles].
- [UNKNOWN: browser-history behavior under all supported browsers after explicit fragment stripping; no browser-level runtime smoke was run in this slice].

## Validation Candidates

- Static route tests: `/auth/login` and `/auth/register` return Auth-hosted redirects with `client_id=marketing-microservice`, callback return URL, and state cookie.
- Callback browser test: missing token fails, state mismatch fails, valid fragment clears state, strips fragment, and redirects to `/admin` without logging tokens.
- Admin Auth tests: missing token returns 401, invalid token returns 401, insufficient role returns 403, valid role reaches expected viewer/operator/admin route.
- Token hygiene scan: changed files and test output do not include raw access tokens, refresh tokens, service tokens, passwords, contact codes, or PII.
- Machine-token regression tests: protected operational APIs continue to require service authorization independently from human admin sessions.
