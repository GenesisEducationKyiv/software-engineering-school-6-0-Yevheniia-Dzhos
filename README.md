# GitHub Release Notification API

Node.js service for subscribing to GitHub repository release notifications.

## What Is Implemented

- REST API documented in `swagger.yaml`
- Email subscription, confirmation, unsubscribe, and subscription listing
- GitHub repository validation through GitHub API
- PostgreSQL persistence with migrations
- Periodic release scanning
- RabbitMQ-based communication with a separate notification service
- ConnectRPC gRPC transport over HTTP/2 for subscription confirmation delivery
- Protobuf contract in `proto/notification/v1/notification.proto`
- Buf lint and code generation through `buf.yaml` and `buf.gen.yaml`
- Orchestrated Saga for subscription confirmation
- Retry and dead-letter queues for notification commands and Saga replies
- Metrics, logging, Docker Compose setup, unit and integration tests

## Notification Communication

Subscription confirmation email delivery uses gRPC:

1. The main application creates a pending subscription and Saga record.
2. The Saga orchestrator calls `NotificationService.SendSubscriptionConfirmation`.
3. The notification service validates the request and sends the email.
4. The orchestrator marks the Saga as `COMPLETED` after a successful gRPC response.
5. If gRPC returns a confirmed delivery error, the orchestrator compensates the
   pending subscription. If the gRPC request times out, the subscription stays
   pending because email delivery may have already happened.

The previous REST implementation remains available at
`POST /api/notifications/subscription-confirmation` for comparison. The
`restClient.js` client is used only as a benchmark/reference baseline, not by
the production confirmation flow. Release notifications still use RabbitMQ
commands because they are asynchronous background work.

The implementation uses `@connectrpc/connect-node` with the gRPC transport over
HTTP/2. It keeps the protobuf contract and gRPC status model while fitting the
existing Node.js ESM codebase.

The gRPC contract lives in:

```text
proto/notification/v1/notification.proto
```

Generate and lint protobuf code with:

```bash
npm run proto:check
```

## Orchestrated Saga

The main application owns subscription state and acts as the Saga orchestrator.
The notification service owns email delivery and acts as the Saga participant.

Flow:

1. `POST /api/subscribe` creates a pending subscription and a Saga record.
2. The orchestrator sends the confirmation command through gRPC.
3. The notification service sends the email.
4. The main application completes the Saga or compensates the pending subscription.

Saga state is stored in PostgreSQL. Timeout recovery compensates Sagas that do
not reach a terminal state. RabbitMQ retry/DLQ topology is still used for
asynchronous notification commands and Saga reply queues.

## Run

```bash
cp .env.example .env
docker compose up --build
```

## Services

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- Notification service REST: `http://localhost:3002`
- Notification service gRPC: `http://localhost:3003`
- MailHog: `http://localhost:8025`
- RabbitMQ UI: `http://localhost:15672`

The notification service's REST and gRPC ports (3002/3003) have no authentication
and are published to the host only for local debugging and the transport
benchmark. Anyone reaching those ports can trigger an email send. Do not expose
them outside a trusted local machine; a real deployment should keep them on the
internal Docker network only (drop the host `ports:` mapping) or add a
service-to-service token.

## Main Endpoints

- `POST /api/subscribe`
- `GET /api/confirm/{token}`
- `GET /api/unsubscribe/{token}`
- `GET /api/subscriptions?email=...`
- `GET /api/sagas`
- `GET /api/sagas/{id}`

Saga monitoring endpoints require `x-saga-api-token` (or a `Bearer` token) matching `SAGA_API_TOKEN`.
If `SAGA_API_TOKEN` is left unset, these endpoints accept requests with no authentication at all,
so always set it outside local development. Running via `docker-compose.yml` enforces this: the
`app` service refuses to start without `SAGA_API_TOKEN` set.

## Tests

```bash
npm run test:unit
npm run lint
npm run test:integration
```

## REST vs gRPC Benchmark

By default the benchmark starts local no-op REST and gRPC handlers. This keeps
the measurement focused on transport overhead instead of SMTP, MailHog, email
templates, or database I/O.

Run:

```bash
npm run benchmark:notification-transport
```

Example local result for 100 requests with concurrency 10:

```bash
REST: 1431.67 req/s
gRPC: 1244.47 req/s
gRPC/REST throughput ratio: 0.87x
```

For this tiny unary payload and no-op handler, REST can be slightly faster
because HTTP/2 and protobuf setup overhead dominates the actual work. In the
real subscription flow, gRPC is still useful because the contract is explicit,
status codes are typed, and the binary protocol scales better for richer
internal APIs.

Optional settings:

```bash
BENCHMARK_REQUESTS=200 BENCHMARK_CONCURRENCY=20 npm run benchmark:notification-transport
```

To benchmark the full running notification service, start the stack and use:

```bash
BENCHMARK_TARGET=service npm run benchmark:notification-transport
```

That mode includes real email delivery through the notification service, so the
numbers measure the whole service path rather than only REST vs gRPC transport.
