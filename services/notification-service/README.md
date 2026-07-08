# Notification Service

The notification service owns email delivery for the GitHub Release Notifier.
It is deployed separately from the main application and is the only service
that knows about SMTP, Nodemailer, and email templates.

## Endpoints

- `GET /health`
- `GET /health/ready`
- `GET /metrics`

## Message Consumer

The service consumes persistent commands from the durable `notifications`
RabbitMQ queue. They are modeled as commands, not domain events, because the
main application asks this service to perform one specific side effect: send an
email.

- `notification.subscription-confirmation.send`
- `notification.release.send`

Message IDs are claimed in PostgreSQL before email delivery and acknowledged
after delivery. Redelivered IDs are acknowledged without sending another email.
Failed commands pass through the configured TTL retry queue and move to the DLQ
after the configured maximum attempts. Invalid commands move directly to the
DLQ.

The topic routing key `notification.*.send` keeps the queue reusable for the
current email commands. If notification command types grow, they can be split
into separate handlers or queues without changing the rest of the system.

The readiness endpoint verifies SMTP and PostgreSQL. The consumer restores its
subscription after RabbitMQ channel loss. SIGTERM and SIGINT stop the HTTP
server, consumer, broker connection, and database pool.

## Local Start

Set the RabbitMQ, SMTP, and application URL environment variables, then run:

```bash
npm run notification:start
```

The service listens on port `3002` by default.
It writes structured JSON logs and exposes Prometheus RED metrics for HTTP traffic.
