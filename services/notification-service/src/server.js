import { createApp } from './app.js';
import { env } from './config.js';
import { createNotificationConsumer } from './consumer.js';
import { pool } from './database.js';
import { startNotificationGrpcServer } from './grpcServer.js';
import { logger, setNotificationMessagesInFlight } from './observability.js';
import { createBrokerClient } from '@notifier/shared/modules/messaging/brokerClient.js';
import { getNotificationTopologyConfig } from '@notifier/shared/modules/messaging/topology.js';
import {
  closeAll,
  closeHttpServer,
  registerGracefulShutdown
} from '@notifier/shared/utils/gracefulShutdown.js';

let grpcServer;
const app = createApp({
  verifyGrpcConnection: async () => {
    if (!grpcServer?.listening) throw new Error('gRPC server is not listening');
  }
});
const brokerClient = createBrokerClient({
  url: env.rabbitmqUrl,
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});
const consumer = createNotificationConsumer({
  brokerClient,
  topology: getNotificationTopologyConfig(env),
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger,
  setNotificationMessagesInFlight
});

let consumerRetryTimer;
let closing = false;

async function startConsumerWithRetry() {
  if (closing) return;

  try {
    await consumer.start();
  } catch (error) {
    logger.error('Notification consumer start failed', { error });

    if (!closing) {
      consumerRetryTimer = setTimeout(
        startConsumerWithRetry,
        env.brokerReconnectDelayMs
      );
    }
  }
}

grpcServer = await startNotificationGrpcServer({
  port: env.grpcPort,
  logger,
  requestTimeoutMs: env.grpcRequestTimeoutMs
});

const server = app.listen(env.port, () => {
  logger.info('Notification service started', { port: env.port });
});

void startConsumerWithRetry();

registerGracefulShutdown({
  logger,
  serviceName: 'notification-service',
  close: () => {
    closing = true;
    if (consumerRetryTimer) {
      clearTimeout(consumerRetryTimer);
      consumerRetryTimer = undefined;
    }

    return closeAll([
      ['http server', () => closeHttpServer(server)],
      ['gRPC server', () => closeHttpServer(grpcServer)],
      ['notification consumer', () => consumer.close()],
      ['broker client', () => brokerClient.close()],
      ['database pool', () => pool.end()]
    ], logger);
  }
});
