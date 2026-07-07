import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;
const originalTimeout = process.env.NOTIFICATION_REQUEST_TIMEOUT_MS;
const originalServiceUrl = process.env.NOTIFICATION_SERVICE_URL;

describe('notification client', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) {
      delete process.env.NOTIFICATION_REQUEST_TIMEOUT_MS;
    } else {
      process.env.NOTIFICATION_REQUEST_TIMEOUT_MS = originalTimeout;
    }
    if (originalServiceUrl === undefined) {
      delete process.env.NOTIFICATION_SERVICE_URL;
    } else {
      process.env.NOTIFICATION_SERVICE_URL = originalServiceUrl;
    }
    vi.resetModules();
  });

  it('sends subscription confirmation requests to the notification service', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const { sendSubscriptionConfirmation } = await import(
      '../../src/modules/notifications/index.js'
    );

    await sendSubscriptionConfirmation('user@example.com', 'token-123', 'owner/repo');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/email'),
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
        body: JSON.stringify({
          to: 'user@example.com',
          templateId: 'subscription-confirmation',
          data: {
            token: 'token-123',
            repo: 'owner/repo'
          }
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

  it('returns a 502 application error when the notification request times out', async () => {
    process.env.NOTIFICATION_REQUEST_TIMEOUT_MS = '1';
    global.fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }));
    const { sendSubscriptionConfirmation } = await import(
      '../../src/modules/notifications/index.js'
    );

    await expect(sendSubscriptionConfirmation(
      'user@example.com',
      'token-123',
      'owner/repo'
    )).rejects.toMatchObject({
      status: 502,
      message: 'Notification service unavailable'
    });
  });

  it('handles a notification service URL with a trailing slash', async () => {
    process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3002/';
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const { sendSubscriptionConfirmation } = await import(
      '../../src/modules/notifications/index.js'
    );

    await sendSubscriptionConfirmation('user@example.com', 'token-123', 'owner/repo');

    expect(global.fetch.mock.calls[0][0].toString()).toBe(
      'http://localhost:3002/notifications/email'
    );
  });
});
