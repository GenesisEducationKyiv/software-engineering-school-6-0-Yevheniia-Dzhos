import { createServer } from 'node:http2';
import { Code, ConnectError } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { NotificationService } from '@notifier/shared/contracts/notification.js';
import { validateSubscriptionConfirmationRequest } from '@notifier/shared/utils/validators.js';
import { sendSubscriptionConfirmation } from './notificationService.js';
import { logger } from './observability.js';

export function createNotificationGrpcHandlers({
  notificationService = { sendSubscriptionConfirmation }
} = {}) {
  return {
    async sendSubscriptionConfirmation(request) {
      const validationError = validateSubscriptionConfirmationRequest(request);

      if (validationError) {
        throw new ConnectError(validationError, Code.InvalidArgument);
      }

      try {
        await notificationService.sendSubscriptionConfirmation(
          request.email.trim().toLowerCase(),
          request.token,
          request.repo.trim()
        );
        return { status: 'sent' };
      } catch (error) {
        logger.error('Notification gRPC email delivery failed', { error });
        throw new ConnectError('Email delivery failed', Code.Unavailable);
      }
    }
  };
}

export function createNotificationGrpcServer({
  handlers,
  requestTimeoutMs = 10000
} = {}) {
  const routes = (router) => {
    router.service(
      NotificationService,
      handlers ?? createNotificationGrpcHandlers()
    );
  };

  const server = createServer(connectNodeAdapter({ routes }));
  server.setTimeout(requestTimeoutMs);
  server.on('session', (session) => {
    session.setTimeout(requestTimeoutMs, () => session.close());
  });

  return server;
}

export async function startNotificationGrpcServer({
  port,
  logger,
  handlers,
  requestTimeoutMs
}) {
  const server = createNotificationGrpcServer({ handlers, requestTimeoutMs });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      logger.info('Notification gRPC server started', { port });
      resolve();
    });
  });

  return server;
}
