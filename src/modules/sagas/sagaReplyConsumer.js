import {
  assertNotificationTopology,
  sagaReplyEvents
} from '@notifier/shared/modules/messaging/topology.js';
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
        logger.error('Saga reply consumer restart failed', { error });
        scheduleRestart();
      });
    }, reconnectDelayMs);
  }

  function getAttemptCount(message) {
    const death = message.properties.headers?.['x-death']?.find((entry) => {
      return entry.queue === topology.sagaReplyQueue;
    });

    return Number(death?.count || 0) + 1;
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

      await handler(reply);
      await recordProcessedSagaReply({
        replyId: reply.id,
        sagaId: reply.sagaId,
        replyType: reply.type
      });
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
          logger.error('Saga reply consumer channel error', { error });
        });
        nextChannel.on('close', () => {
          channel = undefined;
          consumerTag = undefined;
          scheduleRestart();
        });
        const consumer = await nextChannel.consume(
          topology.sagaReplyQueue,
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
