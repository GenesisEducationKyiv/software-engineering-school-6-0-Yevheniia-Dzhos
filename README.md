# GitHub Release Notification API

Node.js service for subscribing to GitHub repository release notifications.

## What Is Implemented

- REST API documented in `swagger.yaml`
- Email subscription, confirmation, unsubscribe, and subscription listing
- GitHub repository validation through GitHub API
- PostgreSQL persistence with migrations
- Periodic release scanning
- RabbitMQ-based communication with a separate notification service
- Orchestrated Saga for subscription confirmation
- Retry and dead-letter queues for notification commands and Saga replies
- Metrics, logging, Docker Compose setup, unit and integration tests

## Orchestrated Saga

The main application owns subscription state and acts as the Saga orchestrator.
The notification service owns email delivery and acts as the Saga participant.

Flow:

1. `POST /api/subscribe` creates a pending subscription and a Saga record.
2. The orchestrator publishes `notification.subscription-confirmation.send`.
3. The notification service sends the email.
4. The notification service publishes a Saga reply:
   - `saga.subscription-confirmation.succeeded`
   - `saga.subscription-confirmation.failed`
5. The main application completes the Saga or compensates the pending subscription.

Saga state is stored in PostgreSQL. RabbitMQ retry/DLQ topology protects both
notification commands and Saga replies from tight retry loops.

## Run

```bash
cp .env.example .env
docker compose up --build
```

## Services

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- Notification service: `http://localhost:3002`
- MailHog: `http://localhost:8025`
- RabbitMQ UI: `http://localhost:15672`

## Main Endpoints

- `POST /api/subscribe`
- `GET /api/confirm/{token}`
- `GET /api/unsubscribe/{token}`
- `GET /api/subscriptions?email=...`
- `GET /api/sagas`
- `GET /api/sagas/{id}`

Saga monitoring endpoints require `x-saga-api-token` when `SAGA_API_TOKEN` is configured.

## Tests

```bash
npm run test:unit
npm run lint
npm run test:integration
```
