import { createApp } from './app.js';
import { env } from './config.js';
import { createNotificationConsumer } from './consumer.js';
import { logger } from './observability.js';
import { createBrokerClient } from '../../../src/modules/messaging/brokerClient.js';
import { getNotificationTopologyConfig } from '../../../src/modules/messaging/topology.js';

const app = createApp();
const brokerClient = createBrokerClient({
  url: env.rabbitmqUrl,
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});
const consumer = createNotificationConsumer({
  brokerClient,
  topology: getNotificationTopologyConfig(env),
  logger
});

await consumer.start();

app.listen(env.port, () => {
  logger.info('Notification service started', { port: env.port });
});
