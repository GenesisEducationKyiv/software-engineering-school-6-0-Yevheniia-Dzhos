import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { NotificationService } from '../src/generated/notification/v1/notification_pb.js';
import { createNotificationGrpcServer } from '../services/notification-service/src/grpcServer.js';

const target = process.env.BENCHMARK_TARGET || 'transport';
const requests = getPositiveIntegerEnv('BENCHMARK_REQUESTS', 100);
const concurrency = getPositiveIntegerEnv('BENCHMARK_CONCURRENCY', 10);

if (!['transport', 'service'].includes(target)) {
  throw new Error('BENCHMARK_TARGET must be transport or service');
}

function getPositiveIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function createPayload(index) {
  return {
    email: `bench-${Date.now()}-${index}@example.com`,
    token: `confirm-token-${index}-${randomUUID()}`,
    repo: 'owner/repo'
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  return `http://127.0.0.1:${server.address().port}`;
}

async function closeServer(server) {
  if (!server?.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createRestBenchmarkServer() {
  return createServer((req, res) => {
    if (
      req.method !== 'POST'
      || req.url !== '/api/notifications/subscription-confirmation'
    ) {
      res.writeHead(404);
      res.end();
      return;
    }

    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"sent"}');
    });
  });
}

function createGrpcBenchmarkServer() {
  return createNotificationGrpcServer({
    handlers: {
      async sendSubscriptionConfirmation() {
        return { status: 'sent' };
      }
    }
  });
}

async function runPool(total, limit, work) {
  let next = 0;
  let completed = 0;
  const startedAt = performance.now();

  async function worker() {
    while (next < total) {
      const index = next;
      next += 1;
      await work(index);
      completed += 1;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, total) }, () => worker())
  );

  const durationMs = performance.now() - startedAt;

  return {
    completed,
    durationMs,
    throughput: completed / (durationMs / 1000)
  };
}

async function runRestBenchmark(restUrl) {
  const endpoint = `${restUrl.replace(/\/$/, '')}/api/notifications/subscription-confirmation`;

  return runPool(requests, concurrency, async (index) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload(index))
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `REST request failed with ${response.status}: ${body || response.statusText}`
      );
    }
  });
}

async function runGrpcBenchmark(grpcUrl) {
  const client = createClient(
    NotificationService,
    createGrpcTransport({ baseUrl: grpcUrl })
  );

  return runPool(requests, concurrency, async (index) => {
    await client.sendSubscriptionConfirmation(createPayload(index));
  });
}

function printResult(label, result) {
  console.log(`${label}: ${result.completed} requests in ${result.durationMs.toFixed(0)} ms`);
  console.log(`${label}: ${result.throughput.toFixed(2)} req/s`);
}

function printComparison(rest, grpc) {
  const ratio = grpc.throughput / rest.throughput;
  console.log(`gRPC/REST throughput ratio: ${ratio.toFixed(2)}x`);
}

async function getBenchmarkTargets() {
  if (target === 'service') {
    return {
      restUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3002',
      grpcUrl: process.env.NOTIFICATION_SERVICE_GRPC_URL || 'http://localhost:3003',
      close: async () => {}
    };
  }

  const restServer = createRestBenchmarkServer();
  const grpcServer = createGrpcBenchmarkServer();
  const [restUrl, grpcUrl] = await Promise.all([
    listen(restServer),
    listen(grpcServer)
  ]);

  return {
    restUrl,
    grpcUrl,
    close: async () => {
      await Promise.all([
        closeServer(restServer),
        closeServer(grpcServer)
      ]);
    }
  };
}

console.log(`Target: ${target}`);
console.log(`Requests: ${requests}`);
console.log(`Concurrency: ${concurrency}`);

const benchmarkTargets = await getBenchmarkTargets();

try {
  console.log(`REST URL: ${benchmarkTargets.restUrl}`);
  console.log(`gRPC URL: ${benchmarkTargets.grpcUrl}`);

  const rest = await runRestBenchmark(benchmarkTargets.restUrl);
  const grpc = await runGrpcBenchmark(benchmarkTargets.grpcUrl);

  printResult('REST', rest);
  printResult('gRPC', grpc);
  printComparison(rest, grpc);
} finally {
  await benchmarkTargets.close();
}
