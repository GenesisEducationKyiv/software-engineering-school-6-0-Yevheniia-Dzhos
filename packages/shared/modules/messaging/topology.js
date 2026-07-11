export const notificationCommands = {
  subscriptionConfirmation: 'notification.subscription-confirmation.send',
  release: 'notification.release.send'
};

export const sagaReplyEvents = {
  subscriptionConfirmationSucceeded: 'saga.subscription-confirmation.succeeded',
  subscriptionConfirmationFailed: 'saga.subscription-confirmation.failed'
};

export function getNotificationTopologyConfig(env) {
  return {
    exchange: env.notificationExchange,
    queue: env.notificationQueue,
    retryExchange: env.notificationRetryExchange,
    retryQueue: env.notificationRetryQueue,
    deadLetterExchange: env.notificationDeadLetterExchange,
    deadLetterQueue: env.notificationDeadLetterQueue,
    sagaReplyExchange: env.sagaReplyExchange,
    sagaReplyQueue: env.sagaReplyQueue,
    sagaReplyRetryExchange: env.sagaReplyRetryExchange,
    sagaReplyRetryQueue: env.sagaReplyRetryQueue,
    sagaReplyDeadLetterExchange: env.sagaReplyDeadLetterExchange,
    sagaReplyDeadLetterQueue: env.sagaReplyDeadLetterQueue,
    retryTtlMs: env.notificationRetryTtlMs,
    maxAttempts: env.notificationMaxAttempts
  };
}

export async function assertNotificationTopology(channel, config) {
  await channel.assertExchange(config.exchange, 'topic', { durable: true });
  await channel.assertExchange(config.retryExchange, 'topic', { durable: true });
  await channel.assertExchange(config.deadLetterExchange, 'topic', { durable: true });
  await channel.assertExchange(config.sagaReplyExchange, 'topic', { durable: true });
  await channel.assertExchange(config.sagaReplyRetryExchange, 'topic', { durable: true });
  await channel.assertExchange(config.sagaReplyDeadLetterExchange, 'topic', {
    durable: true
  });

  await channel.assertQueue(config.queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': config.retryExchange
    }
  });
  await channel.bindQueue(config.queue, config.exchange, 'notification.*.send');

  await channel.assertQueue(config.retryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': config.retryTtlMs,
      'x-dead-letter-exchange': config.exchange
    }
  });
  await channel.bindQueue(config.retryQueue, config.retryExchange, 'notification.*.send');

  await channel.assertQueue(config.deadLetterQueue, { durable: true });
  await channel.bindQueue(
    config.deadLetterQueue,
    config.deadLetterExchange,
    'notification.*.send'
  );

  await channel.assertQueue(config.sagaReplyQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': config.sagaReplyRetryExchange
    }
  });
  await channel.bindQueue(
    config.sagaReplyQueue,
    config.sagaReplyExchange,
    'saga.#'
  );

  await channel.assertQueue(config.sagaReplyRetryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': config.retryTtlMs,
      'x-dead-letter-exchange': config.sagaReplyExchange
    }
  });
  await channel.bindQueue(
    config.sagaReplyRetryQueue,
    config.sagaReplyRetryExchange,
    'saga.#'
  );

  await channel.assertQueue(config.sagaReplyDeadLetterQueue, { durable: true });
  await channel.bindQueue(
    config.sagaReplyDeadLetterQueue,
    config.sagaReplyDeadLetterExchange,
    'saga.#'
  );
}
