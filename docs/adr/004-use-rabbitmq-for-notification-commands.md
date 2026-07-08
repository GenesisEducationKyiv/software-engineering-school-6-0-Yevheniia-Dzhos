# ADR-004: Use RabbitMQ for Notification Commands

## Status

Accepted

## Context

The main application creates subscription confirmations and release
notifications, while the notification service owns SMTP delivery. Synchronous
HTTP delivery coupled API and scanner availability to the notification service
and did not provide durable retries.

## Decision

Use RabbitMQ as a message broker between the main application and the
notification service.

The application publishes persistent commands to the durable `notifications`
topic exchange using publisher confirms:

- `notification.subscription-confirmation.send`
- `notification.release.send`

The notification service consumes from one durable queue with manual
acknowledgements. Failed commands are dead-lettered to a retry queue and return
after a configurable TTL. After the configured maximum attempts, the consumer
publishes the command to the dead-letter exchange.

The consumer claims message IDs in PostgreSQL `processed_messages` before
email delivery. Redelivered IDs are acknowledged without sending another email.

## Consequences

- Notification commands survive service and broker restarts.
- Temporary SMTP failures are retried without a tight retry loop.
- Permanently failing and invalid commands remain available in the DLQ.
- Multiple notification-service instances can act as competing consumers.
- RabbitMQ and PostgreSQL become runtime dependencies of notification-service.
- SMTP delivery and the processed-message record cannot be committed
  atomically, so a crash after claiming but before SMTP delivery can require
  manual investigation.
