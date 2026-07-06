import { describe, expect, it, beforeEach } from 'vitest';
import {
  recordHttpRequest,
  recordReleaseNotificationsSent,
  recordReleaseScannerRepositoryFailure,
  recordReleaseScannerRun,
  renderMetrics,
  resetMetrics
} from '../../src/utils/metrics.js';

function createRequest(path, method = 'GET', routePath = path) {
  return {
    method,
    path,
    originalUrl: path,
    baseUrl: '',
    route: { path: routePath }
  };
}

function createResponse(statusCode) {
  return { statusCode };
}

describe('RED metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('renders request rate and duration metrics', async () => {
    recordHttpRequest(createRequest('/api/subscriptions'), createResponse(200), 0.012);
    recordHttpRequest(createRequest('/api/subscriptions'), createResponse(400), 0.08);

    const metrics = await renderMetrics();

    expect(metrics).toContain('# TYPE http_requests_total counter');
    expect(metrics).toContain('http_requests_total{method="GET",route="/api/subscriptions",status_code="200",status_class="2xx"} 1');
    expect(metrics).toContain('http_requests_total{method="GET",route="/api/subscriptions",status_code="400",status_class="4xx"} 1');
    expect(metrics).not.toContain('http_request_errors_total');
    expect(metrics).toContain('http_request_duration_seconds_sum{method="GET",route="/api/subscriptions"} 0.092');
    expect(metrics).toContain('http_request_duration_seconds_count{method="GET",route="/api/subscriptions"} 2');
    expect(metrics).not.toContain('http_request_duration_seconds_count{method="GET",route="/api/subscriptions",status_code=');
  });

  it('uses cumulative duration buckets and accumulates counters', async () => {
    recordHttpRequest(createRequest('/api/subscriptions'), createResponse(200), 0.012);
    recordHttpRequest(createRequest('/api/subscriptions'), createResponse(200), 0.012);

    const metrics = await renderMetrics();

    expect(metrics).toContain('http_requests_total{method="GET",route="/api/subscriptions",status_code="200",status_class="2xx"} 2');
    expect(metrics).toContain('http_request_duration_seconds_bucket{le="0.01",method="GET",route="/api/subscriptions"} 0');
    expect(metrics).toContain('http_request_duration_seconds_bucket{le="0.025",method="GET",route="/api/subscriptions"} 2');
    expect(metrics).toContain('http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/api/subscriptions"} 2');
  });

  it('uses a stable unknown route label for unmatched routes', async () => {
    recordHttpRequest({
      method: 'GET',
      path: '/wp-login.php'
    }, createResponse(404), 0.02);

    const metrics = await renderMetrics();

    expect(metrics).toContain('route="unknown"');
    expect(metrics).not.toContain('/wp-login.php');
  });

  it('keeps mounted router prefixes and parameterized route templates', async () => {
    recordHttpRequest(createRequest('/api/confirm/token-123', 'GET', '/confirm/:token'), createResponse(200), 0.02);

    expect(await renderMetrics()).toContain('route="/api/confirm/:token"');
  });

  it('does not record probe endpoints as application traffic', async () => {
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.003);
    recordHttpRequest(createRequest('/metrics'), createResponse(200), 0.005);

    expect(await renderMetrics()).not.toContain('route="/health"');
    expect(await renderMetrics()).not.toContain('route="/metrics"');
  });

  it('renders metric definitions when no traffic has been recorded', async () => {
    const metrics = await renderMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# HELP http_request_duration_seconds');
  });

  it('includes default Node.js process metrics from prom-client', async () => {
    const metrics = await renderMetrics();

    expect(metrics).toContain('# HELP process_cpu_user_seconds_total');
  });

  it('renders release scanner business metrics', async () => {
    recordReleaseScannerRun('success', 1.2);
    recordReleaseNotificationsSent(3);
    recordReleaseScannerRepositoryFailure('octocat/Hello-World');

    const metrics = await renderMetrics();

    expect(metrics).toContain('release_scanner_runs_total{status="success"} 1');
    expect(metrics).toContain('release_scanner_duration_seconds_sum{status="success"} 1.2');
    expect(metrics).toContain('release_notifications_sent_total 3');
    expect(metrics).toContain('release_scanner_repository_failures_total{repository="octocat/Hello-World"} 1');
  });
});