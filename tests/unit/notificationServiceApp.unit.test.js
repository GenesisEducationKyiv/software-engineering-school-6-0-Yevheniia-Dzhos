import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn(),
  sendReleaseNotification: vi.fn()
}));
vi.mock('../../services/notification-service/src/emailClient.js', () => ({
  verifyEmailConnection: vi.fn()
}));

const notificationService = await import(
  '../../services/notification-service/src/notificationService.js'
);
const emailClient = await import('../../services/notification-service/src/emailClient.js');
const { createApp } = await import('../../services/notification-service/src/app.js');

describe('notification service app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles subscription confirmation notifications', async () => {
    const response = await request(createApp())
      .post('/notifications/subscription-confirmation')
      .send({
        email: 'user@example.com',
        token: 'token-123',
        repo: 'owner/repo'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'sent' });
    expect(notificationService.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'token-123', 'owner/repo');
  });

  it('rejects incomplete release notifications', async () => {
    const response = await request(createApp())
      .post('/notifications/release')
      .send({ email: 'user@example.com' });

    expect(response.status).toBe(400);
    expect(notificationService.sendReleaseNotification).not.toHaveBeenCalled();
  });

  it('handles release notifications', async () => {
    const response = await request(createApp())
      .post('/notifications/release')
      .send({
        email: 'user@example.com',
        repo: 'owner/repo',
        tag: 'v1.2.3',
        unsubscribeToken: 'unsubscribe-token'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'sent' });
    expect(notificationService.sendReleaseNotification)
      .toHaveBeenCalledWith('user@example.com', 'owner/repo', 'v1.2.3', 'unsubscribe-token');
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
    await request(app)
      .post('/notifications/subscription-confirmation')
      .send({
        email: 'metrics@example.com',
        token: 'token-123',
        repo: 'owner/repo'
      });
    const metricsResponse = await request(app).get('/metrics');

    expect(healthResponse.headers['x-request-id']).toBe('request-123');
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain(
      'http_requests_total{method="POST",route="/notifications/subscription-confirmation",status_code="200",status_class="2xx"}'
    );
  });
});
