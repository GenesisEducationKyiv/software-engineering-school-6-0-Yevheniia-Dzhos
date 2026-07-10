import { describe, expect, it, vi } from 'vitest';
import { createNotificationRestClient } from '../../src/modules/notifications/restClient.js';

function createResponse({ ok, status, body }) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body)
  };
}

describe('notification REST client', () => {
  it('sends subscription confirmation requests to notification-service', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse({ ok: true, status: 200, body: { status: 'sent' } })
    );
    const client = createNotificationRestClient({
      baseUrl: 'http://notification-service:3002/',
      fetchImpl
    });

    await expect(client.sendSubscriptionConfirmation(
      'user@example.com',
      'confirm-token-123',
      'owner/repo'
    )).resolves.toEqual({ status: 'sent' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://notification-service:3002/api/notifications/subscription-confirmation',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: expect.any(AbortSignal),
        body: JSON.stringify({
          email: 'user@example.com',
          token: 'confirm-token-123',
          repo: 'owner/repo'
        })
      }
    );
  });

  it('maps validation errors from notification-service', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse({
        ok: false,
        status: 400,
        body: { error: 'Invalid or missing field: email' }
      })
    );
    const client = createNotificationRestClient({
      baseUrl: 'http://notification-service:3002',
      fetchImpl
    });

    await expect(client.sendSubscriptionConfirmation('', 'token', 'owner/repo'))
      .rejects.toMatchObject({
        status: 400,
        message: 'Invalid or missing field: email'
      });
  });

  it('maps delivery failures to 502', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse({
        ok: false,
        status: 502,
        body: { error: 'Email delivery failed' }
      })
    );
    const client = createNotificationRestClient({
      baseUrl: 'http://notification-service:3002',
      fetchImpl
    });

    await expect(client.sendSubscriptionConfirmation(
      'user@example.com',
      'confirm-token-123',
      'owner/repo'
    )).rejects.toMatchObject({
      status: 502,
      message: 'Email delivery failed'
    });
  });

  it('maps request timeouts to 502', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));
    const client = createNotificationRestClient({
      baseUrl: 'http://notification-service:3002',
      fetchImpl
    });

    await expect(client.sendSubscriptionConfirmation(
      'user@example.com',
      'confirm-token-123',
      'owner/repo'
    )).rejects.toMatchObject({
      status: 502,
      message: 'Notification service unavailable'
    });
  });
});
