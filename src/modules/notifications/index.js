import { env } from '../../config/env.js';
import { createBrokerClient } from '@notifier/shared/modules/messaging/brokerClient.js';
import { createNotificationPublisher } from '@notifier/shared/modules/messaging/notificationPublisher.js';
import {
  getNotificationTopologyConfig,
  notificationCommands
} from '@notifier/shared/modules/messaging/topology.js';
import { logger } from '@notifier/shared/modules/observability/index.js';

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

export async function sendSubscriptionConfirmation(email, token, repo) {
  await publisher.publish(notificationCommands.subscriptionConfirmation, {
    email,
    token,
    repo
  });
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
