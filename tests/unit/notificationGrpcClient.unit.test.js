import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it, vi } from 'vitest';
import { createNotificationGrpcClient } from '../../src/modules/notifications/grpcClient.js';

describe('notification gRPC client', () => {
  it('sends subscription confirmation requests to notification-service', async () => {
    const sendSubscriptionConfirmation = vi.fn()
      .mockResolvedValue({ status: 'sent' });
    const client = createNotificationGrpcClient({
      client: { sendSubscriptionConfirmation }
    });

    await expect(client.sendSubscriptionConfirmation(
      'user@example.com',
      'confirm-token-123',
      'owner/repo'
    )).resolves.toEqual({ status: 'sent' });

    expect(sendSubscriptionConfirmation).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: 'confirm-token-123',
      repo: 'owner/repo'
    });
  });

  it('maps invalid argument errors to 400', async () => {
    const sendSubscriptionConfirmation = vi.fn()
      .mockRejectedValue(
        new ConnectError('Invalid or missing field: email', Code.InvalidArgument)
      );
    const client = createNotificationGrpcClient({
      client: { sendSubscriptionConfirmation }
    });

    await expect(client.sendSubscriptionConfirmation('', 'token', 'owner/repo'))
      .rejects.toMatchObject({
        status: 400,
        message: 'Invalid or missing field: email'
      });
  });

  it('maps delivery failures to 502', async () => {
    const sendSubscriptionConfirmation = vi.fn()
      .mockRejectedValue(
        new ConnectError('Email delivery failed', Code.Unavailable)
      );
    const client = createNotificationGrpcClient({
      client: { sendSubscriptionConfirmation }
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
});
