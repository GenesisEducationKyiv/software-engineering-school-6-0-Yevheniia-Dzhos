# ADR-002: Use a Modular Monolith with a Notification Service

## Status

Accepted

## Context

The project is a relatively small system with:
- one API
- one database
- one background scanner
- a separately deployed email notification service

Alternatives considered:
- a single deployable monolith
- fully distributed microservices

## Decision

Use a modular monolith for the API, subscriptions, repository tracking, and
scanner. Deploy email delivery as a separate notification service.

## Rationale

The modular monolith provides:
- simpler development
- lower infrastructure complexity
- easier debugging
- reduced operational overhead

Separating notification delivery isolates SMTP concerns and allows email delivery
to evolve independently without distributing every domain module.

## Consequences

### Positive
- faster development
- easier local setup
- easier debugging and testing
- isolated email delivery

### Negative
- the main API and scanner still scale together
- shared root dependencies couple the two deployables
- Docker deployment is more complex than a single monolith

## Future Considerations

Microservices may become reasonable if:
- notification delivery scales independently
- scanning becomes resource-intensive
- multiple teams work on separate domains
