import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { NotificationService } from '../../generated/notification/v1/notification_pb.js';
import { AppError } from '../../utils/errors.js';

function createNotificationClient(baseUrl) {
  return createClient(
    NotificationService,
    createGrpcTransport({ baseUrl })
  );
}

function mapGrpcError(error) {
  const connectError = ConnectError.from(error);

  if (connectError.code === Code.InvalidArgument) {
    return new AppError(400, connectError.rawMessage);
  }

  return new AppError(
    502,
    connectError.rawMessage || 'Notification service unavailable'
  );
}

export function createNotificationGrpcClient({ baseUrl, client } = {}) {
  const notificationClient = client ?? createNotificationClient(baseUrl);

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
