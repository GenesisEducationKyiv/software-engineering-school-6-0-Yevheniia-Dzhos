import { describe, expect, it, beforeEach } from 'vitest';
import {
  createMetrics,
  recordHttpRequest,
  renderMetrics,
  resetMetrics,
  setGauge
} from '@notifier/shared/modules/observability/metrics.js';

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

  it('renders request rate, error and duration metrics', () => {
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.012);
    recordHttpRequest(createRequest('/api/subscriptions'), createResponse(400), 0.08);

    const metrics = renderMetrics();

    expect(metrics).toContain('# TYPE http_requests_total counter');
    expect(metrics).toContain('http_requests_total{method="GET",route="/health",status_code="200",status_class="2xx"} 1');
    expect(metrics).toContain('http_request_errors_total{method="GET",route="/api/subscriptions",status_code="400",status_class="4xx"} 1');
    expect(metrics).not.toContain('http_request_errors_total{method="GET",route="/health"');
    expect(metrics).toContain('http_request_duration_seconds_sum{method="GET",route="/health"} 0.012');
    expect(metrics).toContain('http_request_duration_seconds_count{method="GET",route="/health"} 1');
    expect(metrics).not.toContain('http_request_duration_seconds_count{method="GET",route="/health",status_code=');
  });

  it('uses cumulative duration buckets and accumulates counters', () => {
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.012);
    recordHttpRequest(createRequest('/health'), createResponse(200), 0.012);

    const metrics = renderMetrics();

    expect(metrics).toContain('http_requests_total{method="GET",route="/health",status_code="200",status_class="2xx"} 2');
    expect(metrics).toContain('http_request_duration_seconds_bucket{method="GET",route="/health",le="0.01"} 0');
    expect(metrics).toContain('http_request_duration_seconds_bucket{method="GET",route="/health",le="0.025"} 2');
    expect(metrics).toContain('http_request_duration_seconds_bucket{method="GET",route="/health",le="+Inf"} 2');
  });

  it('uses a stable unknown route label for unmatched routes', () => {
    recordHttpRequest({
      method: 'GET',
      path: '/wp-login.php'
    }, createResponse(404), 0.02);

    const metrics = renderMetrics();

    expect(metrics).toContain('route="unknown"');
    expect(metrics).not.toContain('/wp-login.php');
  });

  it('keeps mounted router prefixes and parameterized route templates', () => {
    recordHttpRequest(createRequest('/api/confirm/token-123', 'GET', '/confirm/:token'), createResponse(200), 0.02);

    expect(renderMetrics()).toContain('route="/api/confirm/:token"');
  });

  it('does not record Prometheus scrapes as application traffic', () => {
    recordHttpRequest(createRequest('/metrics'), createResponse(200), 0.005);

    expect(renderMetrics()).not.toContain('route="/metrics"');
  });

  it('renders metric definitions when no traffic has been recorded', () => {
    const metrics = renderMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# HELP http_request_errors_total');
    expect(metrics).toContain('# HELP http_request_duration_seconds');
  });

  it('renders gauge values and overwrites them on updates', () => {
    setGauge('notification_messages_in_flight', 'Messages being processed.', {}, 2);

    expect(renderMetrics()).toContain('# TYPE notification_messages_in_flight gauge');
    expect(renderMetrics()).toContain('notification_messages_in_flight 2');

    setGauge('notification_messages_in_flight', 'Messages being processed.', {}, 0);

    expect(renderMetrics()).toContain('notification_messages_in_flight 0');
  });

  it('keeps metrics from separate services isolated', () => {
    const firstService = createMetrics();
    const secondService = createMetrics();

    firstService.recordHttpRequest(createRequest('/health'), createResponse(200), 0.01);

    expect(firstService.renderMetrics()).toContain('route="/health"');
    expect(secondService.renderMetrics()).not.toContain('route="/health"');
  });
});