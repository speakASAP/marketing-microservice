# Channel Registry Contract

## Owner

Notifications-microservice owns channel registry behavior, outbound providers, provider credentials, and final send execution.

Marketing-microservice selects the requested/effective channel and optional `channelKey`, then delegates delivery to notifications-microservice.

## Supported Channels

- `email`
- `telegram`
- `whatsapp`

## Marketing Request Fields To Notifications

- `recipient`
- `message`
- `type`
- `channel`
- `service`
- `purpose`
- Optional `subject`
- Optional `channelKey`

## Rules

- Marketing must not store provider credentials.
- Marketing must not call provider APIs directly.
- If `channelKey` is omitted, notifications may resolve a default path for backward compatibility.
- Marketing records the requested channel, effective channel, and delivery outcome returned or inferred from the notification call.

