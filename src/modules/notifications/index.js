import { env } from '../../config/env.js';
import { createBrokerClient } from '@notifier/shared/modules/messaging/brokerClient.js';
import { createNotificationPublisher } from '@notifier/shared/modules/messaging/notificationPublisher.js';
import { createNotificationGrpcClient } from './grpcClient.js';
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
const grpcClient = createNotificationGrpcClient({
  baseUrl: env.notificationServiceGrpcUrl,
  timeoutMs: env.notificationServiceGrpcTimeoutMs
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

export async function sendSubscriptionConfirmationGrpc(email, token, repo) {
  return grpcClient.sendSubscriptionConfirmation(email, token, repo);
}

export async function closeNotificationPublisher() {
  await publisher.close();
  await brokerClient.close();
}
