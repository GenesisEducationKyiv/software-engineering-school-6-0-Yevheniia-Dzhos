# Notification Service

The notification service owns email delivery for the GitHub Release Notifier.
It is deployed separately from the main application and is the only service
that knows about SMTP, Nodemailer, and email templates.

## Endpoints

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`
- `POST /notifications/email`

`POST /notifications/email` accepts a recipient, a template identifier, and
template data:

```json
{
  "to": "user@example.com",
  "templateId": "subscription-confirmation",
  "data": {
    "token": "confirmation-token",
    "repo": "owner/repository"
  }
}
```

## Local Start

Set the SMTP and application URL environment variables, then run:

```bash
npm run notification:start
```

The service listens on port `3002` by default.
It writes structured JSON logs and exposes Prometheus RED metrics for HTTP traffic.
