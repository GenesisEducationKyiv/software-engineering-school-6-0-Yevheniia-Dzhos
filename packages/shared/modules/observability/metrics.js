import client from 'prom-client';
import { getRoutePath, ignoredObservabilityPaths } from './routeContext.js';

const { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } = client;

function getStatusClass(statusCode) {
  return `${Math.floor(statusCode / 100)}xx`;
}

export function createMetrics() {
  const register = new Registry();

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

  const notificationMessagesInFlight = new Gauge({
    name: 'notification_messages_in_flight',
    help: 'Number of notification commands currently being processed.',
    registers: [register]
  });

  function recordHttpRequest(req, res, durationSeconds) {
    if (ignoredObservabilityPaths.has(req.path)) return;

    const statusCode = res.statusCode;
    const labels = {
      method: req.method,
      route: getRoutePath(req),
      status_code: statusCode,
      status_class: getStatusClass(statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe({
      method: labels.method,
      route: labels.route
    }, durationSeconds);
  }

  function recordReleaseScannerRun(status, durationSeconds) {
    const labels = { status };

    releaseScannerRunsTotal.inc(labels);
    releaseScannerDurationSeconds.observe(labels, durationSeconds);
  }

  function recordReleaseNotificationsSent(count) {
    releaseNotificationsSentTotal.inc(count);
  }

  function recordReleaseScannerRepositoryFailure(repository) {
    releaseScannerRepositoryFailuresTotal.inc({ repository });
  }

  function setNotificationMessagesInFlight(count) {
    notificationMessagesInFlight.set(count);
  }

  async function renderMetrics() {
    return register.metrics();
  }

  function getMetricsContentType() {
    return register.contentType;
  }

  function resetMetrics() {
    register.resetMetrics();
  }

  return {
    recordHttpRequest,
    recordReleaseScannerRun,
    recordReleaseNotificationsSent,
    recordReleaseScannerRepositoryFailure,
    setNotificationMessagesInFlight,
    renderMetrics,
    getMetricsContentType,
    resetMetrics
  };
}

export const {
  recordHttpRequest,
  recordReleaseScannerRun,
  recordReleaseNotificationsSent,
  recordReleaseScannerRepositoryFailure,
  setNotificationMessagesInFlight,
  renderMetrics,
  getMetricsContentType,
  resetMetrics
} = createMetrics();
