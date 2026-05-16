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

Alternatives considered:
- MySQL
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

Compared with MySQL, PostgreSQL was selected because it provides a strong relational model, mature transactional behavior, rich SQL features, and good support for future growth if the project needs more advanced constraints, indexing, or query patterns. MySQL would also be a reasonable relational database choice for this project, but PostgreSQL better matches the current implementation and provides more flexibility for future data-model evolution.

Compared with MongoDB, PostgreSQL is a better fit because the data is relational: subscriptions reference repositories, unique constraints prevent duplicates, and confirmation/unsubscribe tokens need consistent lookup and state updates.

## Consequences

### Positive
- strong data consistency
- simple relational queries
- easier duplicate prevention
- reliable migrations

### Negative
- schema migrations are required
- less flexible than document databases
