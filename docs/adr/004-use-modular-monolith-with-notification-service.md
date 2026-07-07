# ADR-004: Use Modular Monolith with Notification Service

## Status

Accepted

## Context

ADR-002 selected a monolithic architecture for the initial project scope. Since
then, the codebase grew separate domain modules and email delivery became a
separate deployable notification service.

The current system has:
- a main API for subscriptions and repository tracking
- a background release scanner
- a PostgreSQL database owned by the main application
- a notification service for SMTP email delivery
- shared infrastructure code for configuration and observability

Alternatives considered:
- keep all email delivery inside the monolith
- split every domain into separate microservices
- use a modular monolith for core domain logic and separate only notification delivery

## Decision

Use a modular monolith for the main application modules and deploy email delivery
as a separate notification service.

The main application owns subscriptions, repository tracking, scanning, and
database access. The notification service owns email delivery and exposes an HTTP
boundary for notification requests.

## Rationale

This keeps the system simple while giving the email boundary real isolation:
- domain modules remain easy to develop and test together
- notification delivery can be deployed and observed separately
- SMTP-specific dependencies stay out of the main application runtime path
- the system avoids the operational overhead of fully distributed microservices

## Consequences

### Positive
- clearer module boundaries inside the main application
- notification delivery has its own deployable runtime
- notification-service can manage its own runtime dependencies
- email concerns can evolve without changing subscription or scanner internals

### Negative
- there are now two deployables to run and monitor
- the notification service still shares repository-level code through `shared/`
- the main API and scanner still scale together

## Follow-ups

- Keep cross-service shared code in `shared/` or a dedicated internal package.
- Avoid imports from one service's private source tree into another service.
- Consider further service extraction only when scaling or ownership requires it.
