# ADR-001: Use PostgreSQL as the Primary Database

## Status

Accepted

## Participants

- Project author
- Course reviewers

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

The main architectural choice was between a relational SQL database and a document-oriented NoSQL database. The subscription model is structured and relational, so a SQL database fits naturally: subscriptions reference repositories, unique constraints prevent duplicates, and confirmation/unsubscribe tokens need consistent lookup and state updates.

MongoDB was considered as a document database alternative, but it is less suitable here because the data model relies on relationships, uniqueness constraints, and transactional updates.

Among SQL databases, both PostgreSQL and MySQL would be reasonable choices for this project. PostgreSQL was selected because it is open-source, mature, widely used, well supported by the Node.js ecosystem, and already fits the implemented schema, migrations, constraints, and indexing needs.

## Consequences

### Positive
- strong data consistency
- simple relational queries
- easier duplicate prevention
- reliable migrations

### Negative
- schema migrations are required
- less flexible than document databases