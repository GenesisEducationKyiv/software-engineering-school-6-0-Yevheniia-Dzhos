import { env } from '../../config/env.js';
import { createBrokerClient } from '../messaging/brokerClient.js';
import { createNotificationPublisher } from '../messaging/notificationPublisher.js';
import {
  getNotificationTopologyConfig,
  notificationCommands
} from '../messaging/topology.js';
import { logger } from '../observability/index.js';

const brokerClient = createBrokerClient({
  url: env.rabbitmqUrl,
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});
const publisher = createNotificationPublisher({
  brokerClient,
  topology: getNotificationTopologyConfig(env),
  logger
});

export async function sendSubscriptionConfirmation(email, token, repo, metadata = {}) {
  const payload = {
    email,
    token,
    repo
  };

  if (metadata.sagaId) payload.sagaId = metadata.sagaId;

  await publisher.publish(notificationCommands.subscriptionConfirmation, payload);
}

export async function sendReleaseNotification(email, repo, tag, unsubscribeToken) {
  await publisher.publish(notificationCommands.release, {
    email,
    repo,
    tag,
    unsubscribeToken
  });
}

export async function closeNotificationPublisher() {
  await publisher.close();
  await brokerClient.close();
}
