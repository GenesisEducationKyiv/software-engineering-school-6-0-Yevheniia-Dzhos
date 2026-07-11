import {
  assertNotificationTopology,
  sagaReplyEvents
} from '@notifier/shared/modules/messaging/topology.js';
import {
  createBrokerConsumerRuntime,
  getDeadLetterAttemptCount
} from '@notifier/shared/modules/messaging/consumerRuntime.js';
import {
  hasProcessedSagaReply,
  recordProcessedSagaReply
} from './sagaRepository.js';
import { handleSubscriptionConfirmationSagaReply } from './subscriptionConfirmationSaga.js';

const handlers = {
  [sagaReplyEvents.subscriptionConfirmationSucceeded]: (reply) => (
    handleSubscriptionConfirmationSagaReply({
      sagaId: reply.sagaId,
      succeeded: true
    })
  ),
  [sagaReplyEvents.subscriptionConfirmationFailed]: (reply) => (
    handleSubscriptionConfirmationSagaReply({
      sagaId: reply.sagaId,
      succeeded: false,
      error: reply.error
    })
  )
};

export function createSagaReplyConsumer({
  brokerClient,
  topology,
  reconnectDelayMs,
  logger
}) {
  function getAttemptCount(message) {
    return getDeadLetterAttemptCount(message, topology.sagaReplyQueue);
  }

  async function moveToDeadLetter(message, deliveryChannel) {
    deliveryChannel.publish(
      topology.sagaReplyDeadLetterExchange,
      message.fields.routingKey || message.properties.type,
      message.content,
      message.properties
    );
    await deliveryChannel.waitForConfirms();
    deliveryChannel.ack(message);
  }

  async function handleMessage(message, deliveryChannel) {
    if (!message) return;

    let reply;

    try {
      reply = JSON.parse(message.content.toString());
    } catch (error) {
      logger.error('Invalid saga reply', {
        messageId: message.properties.messageId,
        error
      });
      deliveryChannel.ack(message);
      return;
    }

    const handler = reply && handlers[reply.type];

    if (!handler || !reply.sagaId || !reply.id) {
      logger.error('Invalid saga reply', {
        messageId: message.properties.messageId,
        type: reply?.type
      });
      deliveryChannel.ack(message);
      return;
    }

    try {
      if (await hasProcessedSagaReply(reply.id)) {
        deliveryChannel.ack(message);
        return;
      }

      const handled = await handler(reply);

      if (handled) {
        await recordProcessedSagaReply({
          replyId: reply.id,
          sagaId: reply.sagaId,
          replyType: reply.type
        });
      }
      deliveryChannel.ack(message);
    } catch (error) {
      logger.error('Saga reply handling failed', {
        messageId: message.properties.messageId,
        attempt: getAttemptCount(message),
        error
      });

      if (getAttemptCount(message) >= topology.maxAttempts) {
        try {
          await moveToDeadLetter(message, deliveryChannel);
        } catch (deadLetterError) {
          logger.error('Saga reply dead-lettering failed', {
            messageId: message.properties.messageId,
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
    queue: topology.sagaReplyQueue,
    reconnectDelayMs,
    logger,
    name: 'Saga reply consumer',
    assertTopology: assertNotificationTopology,
    handleMessage
  });
}
