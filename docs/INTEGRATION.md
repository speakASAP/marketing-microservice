# Integration Notes

## Upstream dependencies

- `AUTH_SERVICE_URL` - registered users and preferences (next phase integration).
- `LEADS_SERVICE_URL` - lead contacts and consent (next phase integration).
- `NOTIFICATION_SERVICE_URL` - required, used as the only outbound channel.
- `LOGGING_SERVICE_URL` - centralized logging sink (JSON logs with timestamp and duration_ms).

## Current Phase 1 behavior

- Segment filters are stored and evaluated in service runtime.
- Contact source is a local stub in `src/store.ts` pending cross-service connectors.
- All outbound sends remain delegated to notifications microservice.
