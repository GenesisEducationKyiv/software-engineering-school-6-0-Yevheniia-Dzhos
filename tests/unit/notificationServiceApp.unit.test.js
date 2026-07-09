import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendNotificationEmail: vi.fn()
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
    vi.resetAllMocks();
    notificationService.sendNotificationEmail.mockResolvedValue(undefined);
    emailClient.verifyEmailConnection.mockResolvedValue(undefined);
  });

  it('handles templated email notifications', async () => {
    const response = await request(createApp())
      .post('/notifications/email')
      .send({
        to: 'user@example.com',
        templateId: 'subscription-confirmation',
        data: {
          token: 'token-123',
          repo: 'owner/repo'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'sent' });
    expect(notificationService.sendNotificationEmail)
      .toHaveBeenCalledWith('user@example.com', 'subscription-confirmation', {
        token: 'token-123',
        repo: 'owner/repo'
      });
  });

  it('rejects incomplete templated email notifications', async () => {
    const response = await request(createApp())
      .post('/notifications/email')
      .send({ to: 'user@example.com' });

    expect(response.status).toBe(400);
    expect(notificationService.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('returns template validation errors as bad requests', async () => {
    notificationService.sendNotificationEmail.mockRejectedValue(Object.assign(
      new Error('Unknown email template: missing-template'),
      { status: 400 }
    ));

    const response = await request(createApp())
      .post('/notifications/email')
      .send({
        to: 'user@example.com',
        templateId: 'missing-template',
        data: {}
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown email template: missing-template' });
  });

  it('reports readiness when SMTP is available', async () => {
    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(emailClient.verifyEmailConnection).toHaveBeenCalledTimes(1);
  });

  it('reports liveness without checking SMTP', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(emailClient.verifyEmailConnection).not.toHaveBeenCalled();
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
      .post('/notifications/email')
      .send({
        to: 'metrics@example.com',
        templateId: 'subscription-confirmation',
        data: {
          token: 'token-123',
          repo: 'owner/repo'
        }
      });
    const metricsResponse = await request(app).get('/metrics');

    expect(healthResponse.headers['x-request-id']).toBe('request-123');
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain(
      'http_requests_total{method="POST",route="/notifications/email",status_code="200",status_class="2xx"}'
    );
  });
});
