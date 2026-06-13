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

Successful commands are acknowledged after email delivery. Failed commands are
rejected into the configured retry topology.

## Local Start

Set the RabbitMQ, SMTP, and application URL environment variables, then run:

```bash
npm run notification:start
```

The service listens on port `3002` by default.
It writes structured JSON logs and exposes Prometheus RED metrics for HTTP traffic.
