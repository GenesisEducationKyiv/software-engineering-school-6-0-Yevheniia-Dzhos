import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/emailClient.js', () => ({
  verifyEmailConnection: vi.fn()
}));

const emailClient = await import('../../services/notification-service/src/emailClient.js');
const { createApp } = await import('../../services/notification-service/src/app.js');

describe('notification service app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports readiness when SMTP is available', async () => {
    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(emailClient.verifyEmailConnection).toHaveBeenCalledTimes(1);
  });

  it('reports not ready when SMTP is unavailable', async () => {
    emailClient.verifyEmailConnection.mockRejectedValue(new Error('SMTP unavailable'));

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not ready' });
  });

  it('exposes request IDs and RED metrics', async () => {
    const app = createApp();
    const healthResponse = await request(app)
      .get('/health')
      .set('x-request-id', 'request-123');
    const metricsResponse = await request(app).get('/metrics');

    expect(healthResponse.headers['x-request-id']).toBe('request-123');
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain(
      'http_requests_total{method="GET",route="/health",status_code="200",status_class="2xx"}'
    );
  });
});
