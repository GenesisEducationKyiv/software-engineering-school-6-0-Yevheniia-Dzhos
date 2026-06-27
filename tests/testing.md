# Testing Strategy

This project uses three test levels. They are separated by responsibility so failures are easier to understand and the suite can grow without turning into one large, fragile check.

## Unit Tests

Unit tests cover business logic in isolation. External collaborators such as repositories, GitHub API calls, token generation, and email sending are mocked.

Covered areas:

- subscription input normalization and validation;
- token pair creation;
- subscription business flow;
- release scanning behavior.

Expected result: the service layer makes correct decisions without requiring a database, network, SMTP server, or browser.

Location: `tests/unit/`

## Integration Tests

Integration tests verify the real API behavior through Express routes, the real database layer, migrations, PostgreSQL, and SMTP transport. GitHub API responses are replaced by a local HTTP stub so tests are deterministic and do not depend on real GitHub availability or rate limits.

Covered endpoints:

- `GET /health`;
- `POST /api/subscribe`;
- `GET /api/confirm/:token`;
- `GET /api/unsubscribe/:token`;
- `GET /api/subscriptions`.

Expected result: all API endpoints return the correct status codes and response bodies, and database state changes correctly after subscribe, confirm, list, and unsubscribe flows.

Location: `tests/integration/`

Integration tests are split by endpoint so each file stays focused as the API grows.

## Why Integration Has Its Own Docker Compose

`tests/docker-compose.integration.yml` is intentionally separate from the main `docker-compose.yml`.

The main compose file is for running the application. It builds the app service, uses the normal application ports, reads `.env`, and keeps a persistent PostgreSQL volume.

The integration compose file is for tests only. It starts only the dependencies that tests need, uses isolated test ports, creates a test database, and is removed with volumes after the test run.

This keeps test runs repeatable and prevents test data from mixing with local development data.

## E2E tests

E2E tests verify the public browser page with Playwright Chromium. They start the real Express app through `tests/e2e/server.mjs` and use Docker-managed PostgreSQL and MailHog for test dependencies.

Covered behavior:

- the subscription page renders;
- form fields and navigation links are visible;
- successful submit shows the expected status message;
- invalid repository input shows the expected validation message.

Expected result: the user-facing page works in desktop and mobile Chromium projects.

Location: `tests/e2e/`

## CI

GitHub Actions is configured in `.github/workflows/ci.yml`.

CI has separate jobs for:

- unit tests;
- integration tests;
- E2E tests.

Separate jobs make the pipeline easier to scale. A failure immediately shows which test level failed instead of hiding everything behind one large `test` job.
