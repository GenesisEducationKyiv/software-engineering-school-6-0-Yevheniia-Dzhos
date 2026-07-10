# ADR-005: Use an Orchestrated Saga for Subscription Confirmation

## Status

Accepted, amended by HW9 gRPC notification delivery

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
`sagas` table and calls the notification service synchronously through
`NotificationService.SendSubscriptionConfirmation` over gRPC.

The original RabbitMQ command/reply path (the `notification.subscription-confirmation.send`
command and the `saga.replies` topology) is still provisioned at startup, but
nothing in the codebase publishes to it anymore. Subscription confirmation
always goes through the synchronous gRPC call now, and the Saga completes in
the same request path after it succeeds. The reply consumer is idle for this
flow, not a live fallback.

- `STARTED`
- `NOTIFICATION_PENDING`
- `COMPLETED`
- `COMPENSATING`
- `COMPENSATED`
- `FAILED`

If a newly created pending subscription definitely cannot receive its
confirmation email, the orchestrator compensates the local subscription step by
deleting that pending subscription. If the gRPC call times out, delivery is
treated as uncertain and the pending subscription is kept.

The orchestrator also runs a periodic recovery job for Sagas that remain in
`NOTIFICATION_PENDING` or `COMPENSATING` longer than the configured timeout.

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
- The active subscription-confirmation path is easier to reason about because
  the gRPC result is handled in the same request path.
- Legacy duplicate Saga replies are safe because reply IDs are stored in
  `processed_saga_replies` and Saga state transitions use compare-and-swap
  checks.
- RabbitMQ retries and dead-letter queues continue to handle transient failures.
- The main HTTP API can start even if RabbitMQ is temporarily unavailable; the
  Saga reply consumer retries connection in the background.

### Negative

- The main application still provisions the RabbitMQ Saga reply consumer and
  topology even though nothing publishes to it anymore for this flow. It is
  unused rather than merely legacy, and is a candidate for removal unless a
  future Saga reuses the async reply pattern.
- The system is eventually consistent, not atomically consistent.
- The orchestrator contains workflow knowledge and must evolve when the flow
  gains more steps.
- A crash after SMTP delivery but before recording the processed message can
  still produce a duplicate email on retry.
- The main application and notification service still share one PostgreSQL
  deployment in this educational project. A production split would give the
  notification service its own database and use integration events/outbox
  records between service-owned stores.
