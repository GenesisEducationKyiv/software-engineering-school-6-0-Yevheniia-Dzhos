import { env } from '../../config/env.js';
import { createBrokerClient } from '../messaging/brokerClient.js';
import { getNotificationTopologyConfig } from '../messaging/topology.js';
import { logger } from '../observability/index.js';
import { createSagaReplyConsumer } from './sagaReplyConsumer.js';
export { default as sagaRoutes } from './sagaRoutes.js';

const brokerClient = createBrokerClient({
  url: env.rabbitmqUrl,
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});

const replyConsumer = createSagaReplyConsumer({
  brokerClient,
  topology: getNotificationTopologyConfig(env),
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});

export async function startSagaReplyConsumer() {
  await replyConsumer.start();
}

export async function closeSagaReplyConsumer() {
  await replyConsumer.close();
  await brokerClient.close();
}

export {
  startSubscriptionConfirmationSaga,
  handleSubscriptionConfirmationSagaReply
} from './subscriptionConfirmationSaga.js';
