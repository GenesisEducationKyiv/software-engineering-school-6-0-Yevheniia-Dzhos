# Modular Architecture

The application is organized around explicit module boundaries instead of
global technical-layer folders.

## Modules

### Subscriptions

Owns the subscription lifecycle:

- create a subscription
- confirm a subscription
- unsubscribe
- list subscriptions
- validate subscription input
- generate subscription tokens
- persist subscription records

Public API: `src/modules/subscriptions/index.js`

### Release Tracking

Owns GitHub repository tracking and release detection:

- communicate with the GitHub API
- register tracked repositories
- store the last seen release tag
- periodically scan for new releases

Public API: `src/modules/releaseTracking/index.js`

### Observability

Provides shared operational capabilities:

- structured logging
- request logging
- HTTP metrics
- `/metrics` endpoint registration

Public API: `packages/shared/modules/observability/index.js`

### Messaging

Provides the shared RabbitMQ connection, notification topology, and publisher.
Lives in `packages/shared` since both the main app and the notification-service
consume it.

Public API: `packages/shared/modules/messaging`

### Sagas

Orchestrates the subscription-confirmation flow as a saga: creates the
subscription and a saga record in one transaction, calls the notification
service synchronously over gRPC, and completes or fails the saga in the same
request path. On a confirmed delivery failure it compensates by deleting the
pending subscription. On a gRPC timeout it keeps the pending subscription
because the email delivery result is unknown.

The RabbitMQ Saga reply consumer, the `saga.replies` topology, and the
`notification.subscription-confirmation.send` command are still provisioned
at startup, but nothing in the codebase publishes that command anymore —
subscription confirmation always goes through the synchronous gRPC call now.
This machinery is unused for this flow, not merely legacy, and is a candidate
for removal unless a future Saga reuses the async reply pattern.

Public API: `src/modules/sagas/index.js`

## Extracted Microservice

### Notification Service

Location: `services/notification-service`

The service owns:

- SMTP and Nodemailer configuration
- email templates
- confirmation email delivery
- release notification delivery

The monolith no longer imports email delivery implementation. It publishes
commands through RabbitMQ using `src/modules/notifications/index.js`.

## Notification Command Contract

### Subscription Confirmation

Routing key: `notification.subscription-confirmation.send`

```json
{
  "id": "message-id",
  "type": "notification.subscription-confirmation.send",
  "occurredAt": "2026-06-14T00:00:00.000Z",
  "payload": {
    "email": "user@example.com",
    "token": "confirmation-token",
    "repo": "owner/repository"
  }
}
```

### Release Notification

Routing key: `notification.release.send`

```json
{
  "id": "message-id",
  "type": "notification.release.send",
  "occurredAt": "2026-06-14T00:00:00.000Z",
  "payload": {
    "email": "user@example.com",
    "repo": "owner/repository",
    "tag": "v1.0.0",
    "unsubscribeToken": "unsubscribe-token"
  }
}
```

The publisher uses RabbitMQ confirms. Publishing failures are exposed by the
monolith as a `502` dependency failure. The consumer acknowledges commands only
after successful email delivery.

## Data Ownership

The main application owns subscription, repository, and release data. The
notification service uses the shared PostgreSQL instance only for the
`processed_messages` idempotency table.
