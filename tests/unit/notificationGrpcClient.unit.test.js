import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it, vi } from 'vitest';
import { createNotificationGrpcClient } from '../../src/modules/notifications/grpcClient.js';

describe('notification gRPC client', () => {
  it('requires a gRPC service URL when no test client is injected', () => {
    expect(() => createNotificationGrpcClient())
      .toThrow('Notification gRPC service URL is not configured');
  });

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

  it('maps delivery failures to 502 without leaking the raw transport error', async () => {
    const sendSubscriptionConfirmation = vi.fn()
      .mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND notification-service')
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
      message: 'Notification gRPC service unavailable'
    });
  });

  it('marks deadline exceeded errors as uncertain delivery timeouts without leaking raw text', async () => {
    const sendSubscriptionConfirmation = vi.fn()
      .mockRejectedValue(
        new ConnectError('deadline exceeded waiting on upstream socket', Code.DeadlineExceeded)
      );
    const client = createNotificationGrpcClient({
      client: { sendSubscriptionConfirmation }
    });

    await expect(client.sendSubscriptionConfirmation(
      'user@example.com',
      'confirm-token-123',
      'owner/repo'
    )).rejects.toMatchObject({
      status: 504,
      message: 'Notification gRPC request timed out',
      deliveryUncertain: true
    });
  });

  it('uses a stable fallback message for empty gRPC failures', async () => {
    const sendSubscriptionConfirmation = vi.fn()
      .mockRejectedValue(new Error(''));
    const client = createNotificationGrpcClient({
      client: { sendSubscriptionConfirmation }
    });

    await expect(client.sendSubscriptionConfirmation(
      'user@example.com',
      'confirm-token-123',
      'owner/repo'
    )).rejects.toMatchObject({
      status: 502,
      message: 'Notification gRPC service unavailable'
    });
  });
});
