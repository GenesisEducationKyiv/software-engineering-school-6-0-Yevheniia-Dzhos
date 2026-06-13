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
RabbitMQ queue:

- `notification.subscription-confirmation.send`
- `notification.release.send`

Successful message IDs are stored in PostgreSQL and acknowledged after email
delivery. Redelivered IDs are acknowledged without sending another email.
Failed commands pass through the configured TTL retry queue and move to the DLQ
after the configured maximum attempts. Invalid commands move directly to the
DLQ.

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
