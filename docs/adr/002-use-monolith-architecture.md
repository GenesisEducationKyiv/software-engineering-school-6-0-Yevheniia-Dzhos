# ADR-002: Use Monolith Architecture

## Status

Accepted

## Context

The project is a relatively small service with:
- one API
- one database
- one background scanner
- email notifications

Alternative considered:
- microservices architecture

## Decision

Use a monolithic architecture.

## Rationale

A monolith provides:
- simpler development
- easier deployment
- lower infrastructure complexity
- easier debugging
- reduced operational overhead

For the current scale of the project, microservices would introduce unnecessary complexity.

## Consequences

### Positive
- faster development
- easier local setup
- simpler Docker deployment
- easier debugging and testing

### Negative
- all components scale together
- tighter coupling between modules
- harder future service separation

## Future Considerations

Microservices may become reasonable if:
- notification delivery scales independently
- scanning becomes resource-intensive
- multiple teams work on separate domains