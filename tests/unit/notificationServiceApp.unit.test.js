import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/emailClient.js', () => ({
  verifyEmailConnection: vi.fn()
}));
vi.mock('../../services/notification-service/src/database.js', () => ({
  verifyDatabaseConnection: vi.fn()
}));
vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn()
}));

const emailClient = await import('../../services/notification-service/src/emailClient.js');
const database = await import('../../services/notification-service/src/database.js');
const notificationService = await import(
  '../../services/notification-service/src/notificationService.js'
);
const { logger } = await import('../../services/notification-service/src/observability.js');
const { createApp } = await import('../../services/notification-service/src/app.js');

describe('notification service app', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    emailClient.verifyEmailConnection.mockResolvedValue(undefined);
    database.verifyDatabaseConnection.mockResolvedValue(undefined);
  });

  it('reports readiness when SMTP and PostgreSQL are available', async () => {
    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(emailClient.verifyEmailConnection).toHaveBeenCalledTimes(1);
    expect(database.verifyDatabaseConnection).toHaveBeenCalledTimes(1);
  });

  it('reports liveness without checking SMTP or PostgreSQL', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(emailClient.verifyEmailConnection).not.toHaveBeenCalled();
    expect(database.verifyDatabaseConnection).not.toHaveBeenCalled();
  });

  it('reports not ready when SMTP is unavailable', async () => {
    emailClient.verifyEmailConnection.mockRejectedValue(new Error('SMTP unavailable'));

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not ready' });
  });

  it('reports not ready when PostgreSQL is unavailable', async () => {
    database.verifyDatabaseConnection.mockRejectedValue(
      new Error('PostgreSQL unavailable')
    );

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not ready' });
  });

  it('reports not ready when gRPC is unavailable', async () => {
    const response = await request(createApp({
      verifyGrpcConnection: async () => {
        throw new Error('gRPC unavailable');
      }
    })).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not ready' });
  });

  it('exposes request IDs and excludes probe endpoints from RED metrics', async () => {
    const app = createApp();
    const healthResponse = await request(app)
      .get('/health')
      .set('x-request-id', 'request-123');
    const metricsResponse = await request(app).get('/metrics');

    expect(healthResponse.headers['x-request-id']).toBe('request-123');
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain('# HELP http_requests_total');
    expect(metricsResponse.text).not.toContain('route="/health"');
  });

  it('sends subscription confirmations through the REST endpoint', async () => {
    const response = await request(createApp())
      .post('/api/notifications/subscription-confirmation')
      .send({
        email: 'User@Example.com',
        token: 'confirm-token-123',
        repo: 'owner/repo'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'sent' });
    expect(notificationService.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'confirm-token-123', 'owner/repo');
  });

  it('validates subscription confirmation REST requests', async () => {
    const response = await request(createApp())
      .post('/api/notifications/subscription-confirmation')
      .send({
        email: 'bad',
        token: 'short',
        repo: 'bad'
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid or missing field: email' });
    expect(notificationService.sendSubscriptionConfirmation).not.toHaveBeenCalled();
  });

  it('maps subscription confirmation delivery failures to 502', async () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const deliveryError = new Error('SMTP unavailable');
    notificationService.sendSubscriptionConfirmation
      .mockRejectedValue(deliveryError);

    const response = await request(createApp())
      .post('/api/notifications/subscription-confirmation')
      .send({
        email: 'user@example.com',
        token: 'confirm-token-123',
        repo: 'owner/repo'
      });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'Email delivery failed' });
    expect(loggerSpy).toHaveBeenCalledWith(
      'Notification REST email delivery failed',
      { error: deliveryError }
    );
  });
});
