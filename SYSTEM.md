# System: marketing-microservice

## Architecture

NestJS + PostgreSQL. Blue/green 4600/4601.

- Segments: auth users, leads, order-based
- Campaign engine: scheduling, throttling, consent, unsubscribe
- All delivery via notifications-microservice

## Integrations

| Service | Usage |
|---------|-------|
| database-server:5432 | PostgreSQL |
| logging-microservice:3367 | Logs |
| auth-microservice:3370 | User segments |
| leads-microservice:4400 | Lead segments |
| notifications-microservice:3368 | Delivery |
| orders-microservice:3203 | Order-based segments |

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
- None
