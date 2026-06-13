import {
  assertNotificationTopology,
  notificationCommands
} from '../../../src/modules/messaging/topology.js';
import {
  sendReleaseNotification,
  sendSubscriptionConfirmation
} from './notificationService.js';

const handlers = {
  [notificationCommands.subscriptionConfirmation]: ({
    email,
    token,
    repo
  }) => sendSubscriptionConfirmation(email, token, repo),
  [notificationCommands.release]: ({
    email,
    repo,
    tag,
    unsubscribeToken
  }) => sendReleaseNotification(email, repo, tag, unsubscribeToken)
};

export function createNotificationConsumer({
  brokerClient,
  topology,
  logger
}) {
  let channel;
  let consumerTag;

  async function handleMessage(message) {
    if (!message) return;

    try {
      const command = JSON.parse(message.content.toString());
      const handler = handlers[command.type];

      if (!handler || !command.payload || command.id !== message.properties.messageId) {
        throw new Error('Invalid notification command');
      }

      await handler(command.payload);
      channel.ack(message);
    } catch (error) {
      logger.error('Notification command handling failed', {
        messageId: message.properties.messageId,
        type: message.properties.type,
        error
      });
      channel.nack(message, false, false);
    }
  }

  async function start() {
    channel = await brokerClient.createChannel();
    await assertNotificationTopology(channel, topology);
    await channel.prefetch(1);
    const consumer = await channel.consume(topology.queue, handleMessage, {
      noAck: false
    });
    consumerTag = consumer.consumerTag;
  }

  async function close() {
    if (!channel) return;
    if (consumerTag) await channel.cancel(consumerTag);
    await channel.close();
    channel = undefined;
    consumerTag = undefined;
  }

  return { start, close };
}
