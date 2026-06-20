import {
  assertNotificationTopology,
  notificationCommands,
  sagaReplyEvents
} from '../../../src/modules/messaging/topology.js';
import {
  sendReleaseNotification,
  sendSubscriptionConfirmation
} from './notificationService.js';
import {
  hasProcessedMessage,
  recordProcessedMessage
} from './processedMessageRepository.js';

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

function createSagaReply(type, command, error) {
  return {
    id: `${command.id}:${type}`,
    type,
    sagaId: command.payload.sagaId,
    commandId: command.id,
    occurredAt: new Date().toISOString(),
    error: error?.message
  };
}

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

  async function publishSagaReply(command, deliveryChannel, type, error) {
    if (command.type !== notificationCommands.subscriptionConfirmation) return;
    if (!command.payload?.sagaId) return;

    const reply = createSagaReply(type, command, error);
    deliveryChannel.publish(
      topology.sagaReplyExchange,
      type,
      Buffer.from(JSON.stringify(reply)),
      {
        contentType: 'application/json',
        persistent: true,
        messageId: reply.id,
        type,
        timestamp: Date.now()
      }
    );
    await deliveryChannel.waitForConfirms();
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
      if (!(await hasProcessedMessage(command.id))) {
        await handler(command.payload);
        await recordProcessedMessage(command.id, command.type);
      }
    } catch (error) {
      logger.error('Notification command handling failed', {
        messageId: message.properties.messageId,
        type: message.properties.type,
        attempt: getAttemptCount(message),
        error
      });

      if (getAttemptCount(message) >= topology.maxAttempts) {
        try {
          await publishSagaReply(
            command,
            deliveryChannel,
            sagaReplyEvents.subscriptionConfirmationFailed,
            error
          );
        } catch (replyError) {
          logger.error('Notification failure reply publishing failed', {
            messageId: message.properties.messageId,
            type: message.properties.type,
            error: replyError
          });
        }

        try {
          await moveToDeadLetter(message, deliveryChannel);
        } catch (deadLetterError) {
          logger.error('Notification command dead-lettering failed', {
            messageId: message.properties.messageId,
            type: message.properties.type,
            error: deadLetterError
          });
          deliveryChannel.nack(message, false, false);
        }
        return;
      }

      deliveryChannel.nack(message, false, false);
      return;
    }

    try {
      await publishSagaReply(
        command,
        deliveryChannel,
        sagaReplyEvents.subscriptionConfirmationSucceeded
      );
      deliveryChannel.ack(message);
    } catch (error) {
      logger.error('Notification success reply publishing failed', {
        messageId: message.properties.messageId,
        type: message.properties.type,
        error
      });
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
