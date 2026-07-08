import {
  assertNotificationTopology,
  notificationCommands
} from '../../../src/modules/messaging/topology.js';
import {
  sendReleaseNotification,
  sendSubscriptionConfirmation
} from './notificationService.js';
import {
  deleteProcessedMessage,
  hasProcessedMessage,
  recordProcessedMessage
} from './processedMessageRepository.js';

const handlers = {
  [notificationCommands.subscriptionConfirmation]: ({
    email,
    token,
    repo
  }, command) => sendSubscriptionConfirmation(email, token, repo, command.id),
  [notificationCommands.release]: ({
    email,
    repo,
    tag,
    unsubscribeToken
  }, command) => sendReleaseNotification(email, repo, tag, unsubscribeToken, command.id)
};

export function createNotificationConsumer({
  brokerClient,
  topology,
  reconnectDelayMs,
  logger
}) {
  let channel;
  let consumerTag;
  let restartTimer;
  let starting;
  let closing = false;
  const inFlight = new Set();

  function scheduleRestart() {
    if (closing || restartTimer) return;

    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      void start().catch((error) => {
        logger.error('Notification consumer restart failed', { error });
        scheduleRestart();
      });
    }, reconnectDelayMs);
  }

  function getAttemptCount(message) {
    const death = message.properties.headers?.['x-death']?.find((entry) => {
      return entry.queue === topology.queue;
    });

    return Number(death?.count || 0) + 1;
  }

  async function moveToDeadLetter(message, deliveryChannel) {
    deliveryChannel.publish(
      topology.deadLetterExchange,
      message.fields.routingKey,
      message.content,
      message.properties
    );
    await deliveryChannel.waitForConfirms();
    deliveryChannel.ack(message);
  }

  async function rejectInvalidCommand(message, deliveryChannel, error) {
    logger.error('Invalid notification command', {
      messageId: message.properties.messageId,
      type: message.properties.type,
      error
    });

    try {
      await moveToDeadLetter(message, deliveryChannel);
    } catch (deadLetterError) {
      logger.error('Notification command dead-lettering failed', {
        messageId: message.properties.messageId,
        type: message.properties.type,
        error: deadLetterError
      });
      deliveryChannel.nack(message, false, true);
    }
  }

  async function handleMessage(message, deliveryChannel) {
    if (!message) return;

    let command;

    try {
      command = JSON.parse(message.content.toString());
    } catch (error) {
      await rejectInvalidCommand(message, deliveryChannel, error);
      return;
    }

    const handler = handlers[command.type];

    if (!handler || !command.payload || command.id !== message.properties.messageId) {
      await rejectInvalidCommand(
        message,
        deliveryChannel,
        new Error('Invalid notification command')
      );
      return;
    }

    try {
      if (await hasProcessedMessage(command.id)) {
        deliveryChannel.ack(message);
        return;
      }

      // Claim before sending: if the process crashes mid-send, the claim
      // already exists so a redelivery won't send a duplicate email. If the
      // handler fails with a normal error (not a crash), the claim is rolled
      // back so the retry/dead-letter flow below can still process it.
      const claimed = await recordProcessedMessage(command.id, command.type);
      if (!claimed) {
        deliveryChannel.ack(message);
        return;
      }

      try {
        await handler(command.payload, command);
      } catch (error) {
        await deleteProcessedMessage(command.id);
        throw error;
      }

      deliveryChannel.ack(message);
    } catch (error) {
      logger.error('Notification command handling failed', {
        messageId: message.properties.messageId,
        type: message.properties.type,
        attempt: getAttemptCount(message),
        error
      });

      if (getAttemptCount(message) >= topology.maxAttempts) {
        try {
          await moveToDeadLetter(message, deliveryChannel);
        } catch (deadLetterError) {
          logger.error('Notification command dead-lettering failed', {
            messageId: message.properties.messageId,
            type: message.properties.type,
            error: deadLetterError
          });
          deliveryChannel.nack(message, false, true);
        }
        return;
      }

      deliveryChannel.nack(message, false, false);
    }
  }

  function consumeMessage(message, deliveryChannel) {
    const task = handleMessage(message, deliveryChannel);
    inFlight.add(task);
    void task.then(
      () => inFlight.delete(task),
      () => inFlight.delete(task)
    );
    return task;
  }

  async function start() {
    if (channel) return;
    if (starting) return starting;

    starting = brokerClient.createConfirmChannel()
      .then(async (nextChannel) => {
        await assertNotificationTopology(nextChannel, topology);
        await nextChannel.prefetch(1);
        channel = nextChannel;
        nextChannel.on('error', (error) => {
          logger.error('Notification consumer channel error', { error });
        });
        nextChannel.on('close', () => {
          channel = undefined;
          consumerTag = undefined;
          scheduleRestart();
        });
        const consumer = await nextChannel.consume(
          topology.queue,
          (message) => consumeMessage(message, nextChannel),
          { noAck: false }
        );
        consumerTag = consumer.consumerTag;
      })
      .catch(async (error) => {
        const failedChannel = channel;
        channel = undefined;
        consumerTag = undefined;
        if (failedChannel) await failedChannel.close().catch(() => undefined);
        throw error;
      })
      .finally(() => {
        starting = undefined;
      });

    return starting;
  }

  async function close() {
    closing = true;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = undefined;
    }
    if (starting) await starting.catch(() => undefined);
    const currentChannel = channel;
    const currentConsumerTag = consumerTag;
    if (currentChannel && currentConsumerTag) {
      await currentChannel.cancel(currentConsumerTag);
    }
    await Promise.allSettled(inFlight);
    if (currentChannel) await currentChannel.close();
    channel = undefined;
    consumerTag = undefined;
  }

  return { start, close };
}
