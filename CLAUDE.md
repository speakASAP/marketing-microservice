# Claude Instructions

Shared rules live here:

- Claude profile: `/home/ssf/.claude/CLAUDE.md`
- Shared ecosystem instructions: `/home/ssf/Documents/Github/CLAUDE.md`
- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# CLAUDE.md (marketing-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

## marketing-microservice

**Purpose**: Centralized campaign and segmentation engine. Runs email/Telegram/WhatsApp campaigns with consent tracking and frequency caps.  
**Port**: 4600 · **Domain**: https://marketing.alfares.cz  
**Stack**: NestJS · PostgreSQL · Kubernetes (`statex-apps`)

### Key constraints
- Never send campaigns without owner approval — all sends require explicit trigger
- Unsubscribe requests must be honored within 24h — highest priority
- Enforce frequency caps per user per channel (stored in DB)
- All message delivery via notifications-microservice — never direct API calls to providers

### Consumers
flipflop-service, speakasap, beauty, statex.

**Ops**: `kubectl logs -n statex-apps -l app=marketing-microservice -f` · `kubectl rollout restart deployment/marketing-microservice -n statex-apps` · `./scripts/deploy.sh`
