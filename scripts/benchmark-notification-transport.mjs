import { performance } from 'node:perf_hooks';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { NotificationService } from '../src/generated/notification/v1/notification_pb.js';

const restUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3002';
const grpcUrl = process.env.NOTIFICATION_SERVICE_GRPC_URL || 'http://localhost:3003';
const requests = Number(process.env.BENCHMARK_REQUESTS || 100);
const concurrency = Number(process.env.BENCHMARK_CONCURRENCY || 10);

function createPayload(index) {
  return {
    email: `bench-${Date.now()}-${index}@example.com`,
    token: `confirm-token-${index}-${crypto.randomUUID()}`,
    repo: 'owner/repo'
  };
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

async function runRestBenchmark() {
  const endpoint = `${restUrl.replace(/\/$/, '')}/api/notifications/subscription-confirmation`;

  return runPool(requests, concurrency, async (index) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload(index))
    });

    if (!response.ok) {
      throw new Error(`REST request failed with ${response.status}`);
    }
  });
}

async function runGrpcBenchmark() {
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

console.log(`Requests: ${requests}`);
console.log(`Concurrency: ${concurrency}`);
console.log(`REST URL: ${restUrl}`);
console.log(`gRPC URL: ${grpcUrl}`);

const rest = await runRestBenchmark();
const grpc = await runGrpcBenchmark();

printResult('REST', rest);
printResult('gRPC', grpc);
