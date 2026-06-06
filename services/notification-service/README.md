# Notification Service

The notification service owns email delivery for the GitHub Release Notifier.
It is deployed separately from the main application and is the only service
that knows about SMTP, Nodemailer, and email templates.

## Endpoints

- `GET /health`
- `POST /notifications/subscription-confirmation`
- `POST /notifications/release`

## Local Start

Set the SMTP and application URL environment variables, then run:

```bash
npm run notification:start
```

The service listens on port `3002` by default.
