export const notificationCommands = {
  subscriptionConfirmation: 'notification.subscription-confirmation.send',
  release: 'notification.release.send'
};

export function getNotificationTopologyConfig(env) {
  return {
    exchange: env.notificationExchange,
    queue: env.notificationQueue,
    retryExchange: env.notificationRetryExchange,
    retryQueue: env.notificationRetryQueue,
    deadLetterExchange: env.notificationDeadLetterExchange,
    deadLetterQueue: env.notificationDeadLetterQueue,
    retryTtlMs: env.notificationRetryTtlMs
  };
}

export async function assertNotificationTopology(channel, config) {
  await channel.assertExchange(config.exchange, 'topic', { durable: true });
  await channel.assertExchange(config.retryExchange, 'topic', { durable: true });
  await channel.assertExchange(config.deadLetterExchange, 'topic', { durable: true });

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
}
