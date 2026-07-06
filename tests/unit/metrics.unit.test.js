import { describe, expect, it, beforeEach } from 'vitest';
import { recordHttpRequest, renderMetrics, resetMetrics } from '../../src/utils/metrics.js';

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
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.012);
    recordHttpRequest(createRequest('/api/subscriptions'), createResponse(400), 0.08);

    const metrics = await renderMetrics();

    expect(metrics).toContain('# TYPE http_requests_total counter');
    expect(metrics).toContain('http_requests_total{method="GET",route="/health",status_code="200",status_class="2xx"} 1');
    expect(metrics).toContain('http_requests_total{method="GET",route="/api/subscriptions",status_code="400",status_class="4xx"} 1');
    expect(metrics).not.toContain('http_request_errors_total');
    expect(metrics).toContain('http_request_duration_seconds_sum{method="GET",route="/health"} 0.012');
    expect(metrics).toContain('http_request_duration_seconds_count{method="GET",route="/health"} 1');
    expect(metrics).not.toContain('http_request_duration_seconds_count{method="GET",route="/health",status_code=');
  });

  it('uses cumulative duration buckets and accumulates counters', async () => {
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.012);
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.012);

    const metrics = await renderMetrics();

    expect(metrics).toContain('http_requests_total{method="GET",route="/health",status_code="200",status_class="2xx"} 2');
    expect(metrics).toContain('http_request_duration_seconds_bucket{le="0.01",method="GET",route="/health"} 0');
    expect(metrics).toContain('http_request_duration_seconds_bucket{le="0.025",method="GET",route="/health"} 2');
    expect(metrics).toContain('http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/health"} 2');
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

  it('does not record Prometheus scrapes as application traffic', async () => {
    recordHttpRequest(createRequest('/metrics'), createResponse(200), 0.005);

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
});