# Test Commands

Run all commands from the repository root.

The runner installs missing Node dependencies when needed. Integration tests also start and stop their Docker dependencies automatically.

## Run Everything

```bash
npm test
```

## Run Unit Tests

```bash
npm run test:unit
```

## Run Integration Tests

```bash
npm run test:integration
```

This command starts PostgreSQL and MailHog from `tests/docker-compose.integration.yml`, runs migrations, executes the API integration suite, and removes the containers and volumes afterward.

Docker Desktop or Docker Engine must be running before this command starts.

## Run E2E Tests

```bash
npm run test:e2e
```

This command installs Playwright dependencies if needed, ensures Chromium is available, starts the local E2E server, and runs the browser tests.

## CI

GitHub Actions runs the same commands in `.github/workflows/ci.yml`:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```
