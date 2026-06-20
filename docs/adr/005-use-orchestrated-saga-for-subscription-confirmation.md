# ADR-005: Use an Orchestrated Saga for Subscription Confirmation

## Status

Accepted

## Context

The application has two runtime services involved in subscription confirmation:

- Main application: owns subscriptions, HTTP API, and repository tracking.
- Notification service: owns email delivery and consumes RabbitMQ commands.

The subscription flow contains two business steps:

1. Create a pending subscription in the main application database.
2. Send a confirmation email through the notification service.

If the email cannot be sent after all retries, the system should not leave a new
pending subscription that the user cannot confirm. This makes the flow a
distributed transaction across two services.

Alternatives considered:

- Two-phase commit
- Choreographed Saga
- Orchestrated Saga

## Decision

Use an orchestrated Saga for the subscription confirmation flow.

The main application acts as the Saga orchestrator. It stores Saga state in the
`sagas` table and publishes the `notification.subscription-confirmation.send`
command through RabbitMQ with a `sagaId`.

The notification service acts as a Saga participant. After processing the
command, it publishes one of these reply events:

- `saga.subscription-confirmation.succeeded`
- `saga.subscription-confirmation.failed`

The main application consumes replies from the durable `saga.replies` queue and
updates the Saga state:

- `STARTED`
- `NOTIFICATION_PENDING`
- `COMPLETED`
- `COMPENSATING`
- `COMPENSATED`
- `FAILED`

If a newly created pending subscription cannot receive its confirmation email,
the orchestrator compensates the local subscription step by deleting that
pending subscription.

## Rationale

### Saga instead of two-phase commit

Two-phase commit requires all participants to support a shared prepare/commit
protocol. That does not fit this system because RabbitMQ message delivery, SMTP
email delivery, and PostgreSQL writes cannot be committed as one atomic
transaction.

Two-phase commit would also make availability worse: participants can be blocked
while waiting for the coordinator. For this project, eventual consistency with a
clear compensating action is simpler and more reliable.

### Orchestration instead of choreography

Choreography would let each service react to events independently. That works
well for large event-driven systems, but it spreads the business flow across
multiple services and makes the order of steps harder to inspect.

Orchestration fits this flow better because the main application already owns
the subscription state and the compensation rule. Keeping the Saga state and
decision logic in one orchestrator makes the workflow easier to test, debug, and
demonstrate.

## Consequences

### Positive

- Saga progress is persisted in PostgreSQL and can be inspected.
- The notification service stays focused on email delivery.
- Failed email delivery can trigger an explicit compensation step.
- Duplicate Saga replies are safe because terminal Saga states are ignored.
- RabbitMQ retries and dead-letter queues continue to handle transient failures.

### Negative

- The main application now depends on RabbitMQ for the Saga reply consumer.
- The system is eventually consistent, not atomically consistent.
- The orchestrator contains workflow knowledge and must evolve when the flow
  gains more steps.
- A crash after SMTP delivery but before recording the processed message can
  still produce a duplicate email on retry.
- There is no timeout scanner for Sagas that remain in `NOTIFICATION_PENDING`
  for too long. A production version should periodically detect such Sagas and
  either compensate them or mark them for manual review.
