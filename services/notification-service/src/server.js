import { createApp } from './app.js';
import { env } from './config.js';
import { createNotificationConsumer } from './consumer.js';
import { pool } from './database.js';
import { logger } from './observability.js';
import { createBrokerClient } from '../../../src/modules/messaging/brokerClient.js';
import { getNotificationTopologyConfig } from '../../../src/modules/messaging/topology.js';
import {
  closeHttpServer,
  registerGracefulShutdown
} from '../../../src/utils/gracefulShutdown.js';

const app = createApp();
const brokerClient = createBrokerClient({
  url: env.rabbitmqUrl,
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});
const consumer = createNotificationConsumer({
  brokerClient,
  topology: getNotificationTopologyConfig(env),
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});

await consumer.start();

const server = app.listen(env.port, () => {
  logger.info('Notification service started', { port: env.port });
});

registerGracefulShutdown({
  logger,
  serviceName: 'notification-service',
  close: async () => {
    await closeHttpServer(server);
    await consumer.close();
    await brokerClient.close();
    await pool.end();
  }
});
