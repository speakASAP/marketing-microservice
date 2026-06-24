# AOS Hosted Auth Modernization Plan: marketing-microservice

Date: 2026-06-24
Repo: marketing-microservice
Status: bootstrap plan only
Central standard: /home/ssf/Documents/Github/auth-microservice/docs/HOSTED_AUTH_CONSUMER_STANDARD.md
Legacy exclusion: legacy speakasap-portal is explicitly out of scope and must not be inspected, edited, deployed, restarted, backfilled, or otherwise changed for this plan.

## Scope Boundaries

Allowed files for this bootstrap worker:
- docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md

Forbidden files and actions for this bootstrap worker:
- Application code, package files, deployment files, environment files, secret files, database migrations, generated artifacts, production logs, live DB rows, Kubernetes Secret data, deploy commands, backfill commands, and smoke commands.
- Legacy speakasap-portal and the legacy speakasap production host.

Future implementation workers must keep the same safety boundary unless an owner-approved coding prompt grants a narrower implementation scope.

## Vision

marketing-microservice should use Auth-hosted human login and registration instead of owning local credential collection. The repo must preserve product-specific profile or domain records while treating Auth as the credential authority.

## Goal Impact

- Align marketing-microservice with the central Auth consumer standard.
- Reduce duplicated credential, password reset, contact-code, and token handling surfaces.
- Keep migration work reviewable by splitting discovery, adapter implementation, backend guard verification, and validation into independent lanes.
- Preserve user-facing behavior except for routing human credential collection through hosted Auth.

## System

- Central Auth contract: /home/ssf/Documents/Github/auth-microservice/docs/HOSTED_AUTH_CONSUMER_STANDARD.md
- Candidate client_id: marketing-microservice
- Candidate callback: https://marketing.alfares.cz/auth/callback
- Candidate class: marketing/product route and status verification candidate
- Registry status from central standard: verification lane
- Runtime allowlist source of truth: [MISSING: verified Auth production redirect allowlist]
- Repo-local current auth architecture: [UNKNOWN: not inspected by this bootstrap worker]

## Feature

Introduce or verify hosted Auth consumer behavior:
- Login and register commands route to Auth-hosted UI with client_id, return_url, and opaque state.
- Callback parses token data from the URL fragment only, validates state, stores a local session through the repo-approved model, strips the fragment, and redirects to a safe in-app path.
- Backend protected routes validate Auth-issued access tokens through the standard server-side pattern or a documented approved exception.
- Product-specific records reference Auth identity without becoming credential authority.

## Task

Create a repo-local modernization plan that enables later implementation without requiring secrets, live database reads, production logs, deploys, backfills, or smoke commands.

Follow-on implementation tasks are not approved by this document alone. They require task-specific coding prompts that preserve the IPS chain and name exact allowed files.

## Execution Plan

1. Discovery lane: inventory current auth surfaces without reading secrets or live data. Capture UI forms, callback routes, API auth endpoints, token storage, backend guards, role checks, logout, and test coverage.
2. Contract lane: compare discovered surfaces to the central hosted Auth consumer standard and mark each required change as keep, replace, remove, or transitional debt.
3. Frontend adapter lane: implement hosted login/register redirects, callback fragment parsing, state validation, fragment stripping, session handoff, and logout cleanup in allowed app files named by a future prompt.
4. Backend guard lane: verify protected routes preserve 401/403 behavior and validate Auth tokens according to the central standard or an approved documented exception.
5. Validation lane: run static checks, unit tests, route checks, and token-marker scans that do not expose tokens, PII, secrets, live rows, or production logs.
6. Integration lane: merge lanes in order after documentation and validation evidence are complete.

## Parallel Workstreams

### Workstream A: Discovery

- Status: ready now
- Owner role: discovery worker
- Objective: map current auth surfaces and session behavior.
- Scope: read-only repo inspection of source and tests; no secrets, env values, production logs, live DB rows, deploys, backfills, or smoke commands.
- Allowed files: future discovery report under docs/orchestrator if approved.
- Forbidden files: application edits, package files, deployment files, env/secret files, DB migrations.
- Expected output: auth surface inventory with [MISSING]/[UNKNOWN] markers.
- Dependencies: none.
- Blockers: [UNKNOWN: current repo auth architecture].
- Validation evidence: grep/static inventory commands only.
- Handoff notes: provide exact files requiring later implementation ownership.

### Workstream B: Frontend Hosted Auth Adapter

- Status: dependency-gated on Workstream A
- Owner role: frontend implementation worker
- Objective: replace local human credential entry points with hosted Auth redirects and callback handling.
- Scope: exact files to be named after discovery.
- Allowed files: [MISSING: approved frontend file list].
- Forbidden files: package/deploy/env/secret files unless a future prompt explicitly permits them.
- Expected output: hosted Auth entry points and callback behavior following the central standard.
- Dependencies: Workstream A and verified callback origin.
- Blockers: [MISSING: production origin or callback route confirmation].
- Validation evidence: app tests/build/static marker checks named by future prompt.
- Handoff notes: preserve state validation and fragment stripping as non-negotiable requirements.

### Workstream C: Backend Token Validation And Roles

- Status: dependency-gated on Workstream A
- Owner role: backend implementation worker
- Objective: ensure protected routes accept Auth-issued tokens and preserve 401/403 and role behavior.
- Scope: exact guard/API files to be named after discovery.
- Allowed files: [MISSING: approved backend file list].
- Forbidden files: DB migrations, secrets, deployment files, live DB reads, and production logs.
- Expected output: backend validation aligned with the central standard or documented approved exception.
- Dependencies: Workstream A and central Auth validation contract.
- Blockers: [UNKNOWN: whether backend guard exists in this repo].
- Validation evidence: unit/integration tests and static checks that do not print tokens or PII.
- Handoff notes: do not redesign machine/service-token boundaries unless the same guard path requires it.

### Workstream D: Validation And Integration

- Status: final integration
- Owner role: integration and validation owner
- Objective: combine implementation lanes and prove behavior without exposing sensitive data.
- Scope: validation reports and approved changed files from implementation lanes.
- Allowed files: [MISSING: approved validation report path].
- Forbidden files/actions: deploys, backfills, smoke commands, production logs, secrets, live DB rows, and legacy speakasap-portal.
- Expected output: concise validation evidence and remaining blockers.
- Dependencies: Workstreams A, B, and C.
- Blockers: [MISSING: approved runtime validation scope].
- Validation evidence: git diff --check, repo tests/builds/static marker scans, protected route tests where available.
- Merge order: A first, then B and C after discovery, then D last.
- Shared files/contracts: central standard only; no shared code files may be edited in parallel without an integration owner.

## Coding Prompt

Future implementation prompt must include:
- Repo name: marketing-microservice
- Central standard path: /home/ssf/Documents/Github/auth-microservice/docs/HOSTED_AUTH_CONSUMER_STANDARD.md
- Exact allowed files and forbidden files.
- Required callback origin and client_id.
- Current auth surface inventory from Workstream A.
- Explicit ban on secrets, env values, live DB rows, production logs, deploys, backfills, smoke commands, and legacy speakasap-portal.
- Validation commands that are safe to run and expected evidence to report.

## Code

No application code is changed by this bootstrap plan.

Planned code behavior, pending approved implementation:
- Hosted Auth redirect URLs use client_id=marketing-microservice.
- return_url must be an absolute HTTPS callback owned by marketing-microservice.
- state must be opaque, generated before redirect, and validated after callback.
- token data must be parsed from the URL fragment only and stripped from browser history immediately.
- session storage must follow the central standard; localStorage or memory token storage is transitional debt unless no BFF cookie adapter exists.

## Validation

Bootstrap validation candidates:
- git status --short --branch
- test -e docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md
- git diff --check -- docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md

Future implementation validation candidates:
- Repo build/test/lint command discovered from package or project files without reading secrets.
- Static marker scan proving local password/contact-code/reset credential forms are removed or documented as transitional debt.
- Callback tests for fragment parsing, state validation, fragment stripping, and safe redirect.
- Backend 401/403 tests for protected routes.
- Token/PII leak scan over changed files and test output.

Open blockers:
- [MISSING: verified production origin and callback route] unless listed above.
- [MISSING: Auth runtime redirect allowlist verification; blocked while Vault/ExternalSecret readiness is unavailable to this worker].
- [UNKNOWN: current repo auth forms, guards, callback routes, and token storage].
- [UNKNOWN: repo-specific test/build commands].
- [MISSING: owner-approved implementation file scope].
