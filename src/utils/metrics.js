import client from 'prom-client';

import { getRequestRoute } from './requestRoute.js';

const { Registry, Counter, Histogram, collectDefaultMetrics } = client;
const register = new Registry();
const ignoredRequestPaths = new Set(['/metrics']);

collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed by the application.',
  labelNames: ['method', 'route', 'status_code', 'status_class'],
  registers: [register]
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

function getStatusClass(statusCode) {
  return `${Math.floor(statusCode / 100)}xx`;
}

export function recordHttpRequest(req, res, durationSeconds) {
  if (ignoredRequestPaths.has(req.path)) return;

  const statusCode = res.statusCode;
  const labels = {
    method: req.method,
    route: getRequestRoute(req),
    status_code: statusCode,
    status_class: getStatusClass(statusCode)
  };

  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe({
    method: labels.method,
    route: labels.route
  }, durationSeconds);

}

export async function renderMetrics() {
  return register.metrics();
}

export function getMetricsContentType() {
  return register.contentType;
}

export function resetMetrics() {
  register.resetMetrics();
}