import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn(),
  sendReleaseNotification: vi.fn()
}));

const notificationService = await import(
  '../../services/notification-service/src/notificationService.js'
);
const { createApp } = await import('../../services/notification-service/src/app.js');

describe('notification service app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts subscription confirmation notifications', async () => {
    const response = await request(createApp())
      .post('/notifications/subscription-confirmation')
      .send({
        email: 'user@example.com',
        token: 'token-123',
        repo: 'owner/repo'
      });

    expect(response.status).toBe(202);
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
});
