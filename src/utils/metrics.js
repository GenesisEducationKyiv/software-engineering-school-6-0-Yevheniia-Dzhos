import client from 'prom-client';

import { getRequestRoute } from './requestRoute.js';

const { Registry, Counter, Histogram, collectDefaultMetrics } = client;
const register = new Registry();
const ignoredRequestPaths = new Set(['/health', '/metrics']);

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

const releaseScannerRunsTotal = new Counter({
  name: 'release_scanner_runs_total',
  help: 'Total release scanner runs.',
  labelNames: ['status'],
  registers: [register]
});

const releaseScannerDurationSeconds = new Histogram({
  name: 'release_scanner_duration_seconds',
  help: 'Release scanner run duration in seconds.',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register]
});

const releaseNotificationsSentTotal = new Counter({
  name: 'release_notifications_sent_total',
  help: 'Total release notification emails sent by the scanner.',
  registers: [register]
});

const releaseScannerRepositoryFailuresTotal = new Counter({
  name: 'release_scanner_repository_failures_total',
  help: 'Total release scanner failures by repository.',
  labelNames: ['repository'],
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

export function recordReleaseScannerRun(status, durationSeconds) {
  const labels = { status };

  releaseScannerRunsTotal.inc(labels);
  releaseScannerDurationSeconds.observe(labels, durationSeconds);
}

export function recordReleaseNotificationsSent(count) {
  releaseNotificationsSentTotal.inc(count);
}

export function recordReleaseScannerRepositoryFailure(repository) {
  releaseScannerRepositoryFailuresTotal.inc({ repository });
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