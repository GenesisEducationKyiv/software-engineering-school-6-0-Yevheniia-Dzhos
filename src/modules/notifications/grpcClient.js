import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { NotificationService } from '../../generated/notification/v1/notification_pb.js';
import { AppError } from '@notifier/shared/utils/errors.js';

function createNotificationClient({ baseUrl, timeoutMs }) {
  if (!baseUrl) {
    throw new AppError(500, 'Notification gRPC service URL is not configured');
  }

  return createClient(
    NotificationService,
    createGrpcTransport({
      baseUrl,
      defaultTimeoutMs: timeoutMs
    })
  );
}

function mapGrpcError(error) {
  const connectError = ConnectError.from(error);

  if (connectError.code === Code.InvalidArgument) {
    return new AppError(
      400,
      connectError.rawMessage || 'Invalid notification request'
    );
  }

  return new AppError(
    502,
    connectError.rawMessage || 'Notification gRPC service unavailable'
  );
}

export function createNotificationGrpcClient({
  baseUrl,
  timeoutMs = 10000,
  client
} = {}) {
  const notificationClient = client ?? createNotificationClient({
    baseUrl,
    timeoutMs
  });

  async function sendSubscriptionConfirmation(email, token, repo) {
    try {
      return await notificationClient.sendSubscriptionConfirmation({
        email,
        token,
        repo
      });
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  return { sendSubscriptionConfirmation };
}
