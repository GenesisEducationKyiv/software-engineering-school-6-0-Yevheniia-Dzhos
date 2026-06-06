import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;

describe('notification client', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it('sends subscription confirmation requests to the notification service', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const { sendSubscriptionConfirmation } = await import(
      '../../src/modules/notifications/index.js'
    );

    await sendSubscriptionConfirmation('user@example.com', 'token-123', 'owner/repo');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/subscription-confirmation'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          token: 'token-123',
          repo: 'owner/repo'
        })
      })
    );
  });

  it('returns a 502 application error when the notification service is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused'));
    const { sendReleaseNotification } = await import(
      '../../src/modules/notifications/index.js'
    );

    await expect(sendReleaseNotification(
      'user@example.com',
      'owner/repo',
      'v1.0.0',
      'unsubscribe-token'
    )).rejects.toMatchObject({
      status: 502,
      message: 'Notification service unavailable'
    });
  });
});
