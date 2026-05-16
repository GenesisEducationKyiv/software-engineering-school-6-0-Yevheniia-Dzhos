# Test Commands

Run all commands from the repository root.

The runner installs missing Node dependencies when needed. Integration tests also start and stop their Docker dependencies automatically.

## Run Everything

```bash
node tests/run-tests.mjs all
```

## Run Unit Tests

```bash
node tests/run-tests.mjs unit
```

## Run Integration Tests

```bash
node tests/run-tests.mjs integration
```

This command starts PostgreSQL and MailHog from `tests/docker-compose.integration.yml`, runs migrations, executes the API integration suite, and removes the containers and volumes afterward.

Docker Desktop or Docker Engine must be running before this command starts.

## Run E2E Tests

```bash
node tests/run-tests.mjs e2e
```

This command installs Playwright dependencies if needed, ensures Chromium is available, starts the local E2E server, and runs the browser tests.

## CI

GitHub Actions runs the same commands in `.github/workflows/ci.yml`:

```bash
node tests/run-tests.mjs unit
node tests/run-tests.mjs integration
node tests/run-tests.mjs e2e
```
