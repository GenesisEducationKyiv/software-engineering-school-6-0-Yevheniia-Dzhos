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

Install Chromium once before the first local E2E run:

```bash
node tests/run-tests.mjs e2e:install
```

Then run the tests without an implicit browser download:

```bash
node tests/run-tests.mjs e2e
```

The E2E command installs missing Node dependencies if needed, starts the local E2E server, and runs the browser tests. Browser installation is a separate command so normal test runs never unexpectedly download a large binary.

## CI

GitHub Actions runs the same commands in `.github/workflows/ci.yml`:

```bash
node tests/run-tests.mjs unit
node tests/run-tests.mjs integration
node tests/run-tests.mjs e2e
```
