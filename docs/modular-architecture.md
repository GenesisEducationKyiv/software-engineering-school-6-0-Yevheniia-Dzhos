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

Public API: `src/modules/observability/index.js`

### Messaging

Provides the shared RabbitMQ connection, notification topology, and publisher.

Public API: `src/modules/messaging`

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
