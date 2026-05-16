# ADR-001: Use PostgreSQL as the Primary Database

## Status

Accepted

## Context

The project stores GitHub repository subscriptions, confirmation tokens, and release metadata.

The system requires:
- reliable persistence
- unique constraints
- relational data structure
- transactional consistency

Alternative considered:
- MongoDB

## Decision

Use PostgreSQL as the primary database.

## Rationale

PostgreSQL provides:
- strong relational modeling
- SQL querying
- transactional guarantees
- unique constraints for subscriptions
- mature ecosystem and tooling

The subscription model is structured and relational, so a SQL database fits naturally.

## Consequences

### Positive
- strong data consistency
- simple relational queries
- easier duplicate prevention
- reliable migrations

### Negative
- schema migrations are required
- less flexible than document databases