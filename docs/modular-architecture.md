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

## Extracted Microservice

### Notification Service

Location: `services/notification-service`

The service owns:

- SMTP and Nodemailer configuration
- email templates
- template-based email delivery

The monolith no longer imports email delivery implementation. It communicates
with the notification service through HTTP using the client exposed by
`src/modules/notifications/index.js`.

## Internal HTTP Contract

### Send Templated Email

`POST /notifications/email`

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

The main application chooses the `templateId` and provides the template data.
The notification service validates that the requested template exists and that
its required fields are present.

Example release notification payload:


```json
{
  "to": "user@example.com",
  "templateId": "release-notification",
  "data": {
    "repo": "owner/repository",
    "tag": "v1.0.0",
    "unsubscribeToken": "unsubscribe-token"
  }
}
```

The notification service returns `200 OK` after sending a valid
notification request. Invalid payloads return `400`. Delivery failures return
`500`, which the monolith exposes as a `502` dependency failure.

## Data Ownership

The main application owns PostgreSQL and all subscription and repository data.
The notification service is stateless and does not access the main database.
