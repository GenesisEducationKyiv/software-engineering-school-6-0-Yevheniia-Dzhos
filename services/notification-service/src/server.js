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

const app = createApp();
const grpcServer = await startNotificationGrpcServer({
  port: env.grpcPort,
  logger
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

const server = app.listen(env.port, () => {
  logger.info('Notification service started', { port: env.port });
});

registerGracefulShutdown({
  logger,
  serviceName: 'notification-service',
  close: () => closeAll([
    ['http server', () => closeHttpServer(server)],
    ['gRPC server', () => closeHttpServer(grpcServer)],
    ['notification consumer', () => consumer.close()],
    ['broker client', () => brokerClient.close()],
    ['database pool', () => pool.end()]
  ], logger)
});

await consumer.start().catch((error) => {
  logger.error('Notification consumer failed to start', { error });
  process.exit(1);
});
