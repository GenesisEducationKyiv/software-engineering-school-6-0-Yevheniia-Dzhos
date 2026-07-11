# ADR-006: Enforce Layered Module Boundaries

## Status

Accepted

## Context

The project has grown from a simple Express application into a modular system
with a main app, a notification service, RabbitMQ messaging, gRPC transport,
saga orchestration, metrics, and background jobs.

Without explicit dependency rules, modules can slowly start importing each
other's internal files. That makes later refactoring harder and makes homework
branches conflict more often because unrelated modules become coupled.

## Decision

Use module public APIs and layered dependency rules.

Each module exposes its supported cross-module API from:

```text
src/modules/<module>/index.js
```

Other modules must import through that file instead of importing internal
controllers, services, repositories, or topology files directly.

Inside a module, code follows this direction:

```text
Routes -> Controllers -> Services -> Repositories / Clients
```

Repositories do not import services or controllers. Controllers do not import
repositories directly. Services do not depend on Express request/response
objects.

These rules are checked by
`tests/unit/architectureDependencies.unit.test.js` and can be run with:

```bash
npm run arch:check
```

## Consequences

### Positive

- Module internals can change without breaking other modules.
- Controllers stay thin.
- Business logic remains testable outside Express.
- Architecture rules are verified in CI through unit tests.
- Future homework branches have fewer accidental conflicts.

### Negative

- Some simple calls need a small public wrapper function.
- Developers must update module `index.js` files when exposing new behavior.
- The custom architecture test is intentionally simple and may need more rules
  if the architecture becomes more complex.
