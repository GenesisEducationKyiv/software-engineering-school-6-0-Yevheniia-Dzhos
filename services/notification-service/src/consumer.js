import {
  assertNotificationTopology,
  notificationCommands,
  sagaReplyEvents
} from '@notifier/shared/modules/messaging/topology.js';
import { createBrokerConsumerRuntime } from '@notifier/shared/modules/messaging/consumerRuntime.js';
import {
  sendReleaseNotification,
  sendSubscriptionConfirmation
} from './notificationService.js';
import {
  deleteProcessedMessage,
  hasProcessedMessage,
  markProcessedMessageSent,
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

const payloadFields = {
  [notificationCommands.subscriptionConfirmation]: ['email', 'token', 'repo'],
  [notificationCommands.release]: ['email', 'repo', 'tag', 'unsubscribeToken']
};

function hasRequiredPayloadFields(type, payload) {
  const fields = payloadFields[type];
  return Boolean(
    fields
    && payload
    && typeof payload === 'object'
    && fields.every((field) => typeof payload[field] === 'string' && payload[field])
  );
}

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
  logger,
  setNotificationMessagesInFlight = () => { }
}) {
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

    if (
      !handler
      || !hasRequiredPayloadFields(command.type, command.payload)
      || command.id !== message.properties.messageId
    ) {
      await rejectInvalidCommand(
        message,
        deliveryChannel,
        new Error('Invalid notification command')
      );
      return;
    }

    try {
      if (!(await hasProcessedMessage(command.id))) {
        const claimed = await recordProcessedMessage(command.id, command.type);
        if (!claimed) {
          deliveryChannel.ack(message);
          return;
        }

        try {
          await handler(command.payload, command);
          await markProcessedMessageSent(command.id);
        } catch (error) {
          await deleteProcessedMessage(command.id);
          throw error;
        }
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
          deliveryChannel.nack(message, false, false);
          return;
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
          deliveryChannel.nack(message, false, false);
        }
        return;
      }

      deliveryChannel.nack(message, false, false);
    }
  }

  return createBrokerConsumerRuntime({
    brokerClient,
    topology,
    queue: topology.queue,
    reconnectDelayMs,
    logger,
    name: 'Notification consumer',
    assertTopology: assertNotificationTopology,
    handleMessage,
    onInFlightChange: setNotificationMessagesInFlight
  });
}
