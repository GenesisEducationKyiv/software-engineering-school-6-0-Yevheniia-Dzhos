import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../src/generated/notification/v1/notification_pb.js';

vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn()
}));

const {
  createNotificationGrpcHandlers,
  createNotificationGrpcServer
} = await import('../../services/notification-service/src/grpcServer.js');

describe('notification gRPC server', () => {
  const notificationService = {
    sendSubscriptionConfirmation: vi.fn()
  };

  beforeEach(() => {
    notificationService.sendSubscriptionConfirmation.mockReset();
  });

  it('sends subscription confirmations through the gRPC handler', async () => {
    const handlers = createNotificationGrpcHandlers({ notificationService });

    const response = await handlers.sendSubscriptionConfirmation({
      email: ' User@Example.com ',
      token: 'confirm-token-123',
      repo: 'owner/repo'
    });

    expect(response).toEqual({ status: 'sent' });
    expect(notificationService.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'confirm-token-123', 'owner/repo');
  });

  it('maps invalid gRPC requests to INVALID_ARGUMENT', async () => {
    const handlers = createNotificationGrpcHandlers({ notificationService });

    let error;
    try {
      await handlers.sendSubscriptionConfirmation({
        email: 'bad',
        token: 'short',
        repo: 'bad'
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ConnectError);
    expect(error.code).toBe(Code.InvalidArgument);
    expect(error.message).toContain('Invalid or missing field: email');
    expect(notificationService.sendSubscriptionConfirmation).not.toHaveBeenCalled();
  });

  it('maps delivery failures to UNAVAILABLE', async () => {
    notificationService.sendSubscriptionConfirmation
      .mockRejectedValue(new Error('SMTP unavailable'));
    const handlers = createNotificationGrpcHandlers({ notificationService });

    let error;
    try {
      await handlers.sendSubscriptionConfirmation({
        email: 'user@example.com',
        token: 'confirm-token-123',
        repo: 'owner/repo'
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ConnectError);
    expect(error.code).toBe(Code.Unavailable);
    expect(error.message).toContain('Email delivery failed');
  });

  it('serves unary gRPC requests over HTTP/2', async () => {
    const handlers = createNotificationGrpcHandlers({ notificationService });
    const server = createNotificationGrpcServer({ handlers });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const { port } = server.address();
      const client = createClient(
        NotificationService,
        createGrpcTransport({ baseUrl: `http://127.0.0.1:${port}` })
      );

      const response = await client.sendSubscriptionConfirmation({
        email: 'user@example.com',
        token: 'confirm-token-123',
        repo: 'owner/repo'
      });

      expect(response.status).toBe('sent');
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
