import {
  getOptionalEnv,
  getPositiveIntegerEnv
} from './envParsers.js';

export function getMessagingEnv() {
  return {
    rabbitmqUrl: getOptionalEnv('RABBITMQ_URL', 'amqp://localhost:5672'),
    notificationExchange: getOptionalEnv('NOTIFICATION_EXCHANGE', 'notifications'),
    notificationQueue: getOptionalEnv('NOTIFICATION_QUEUE', 'notifications'),
    notificationRetryExchange: getOptionalEnv(
      'NOTIFICATION_RETRY_EXCHANGE',
      'notifications.retry'
    ),
    notificationRetryQueue: getOptionalEnv(
      'NOTIFICATION_RETRY_QUEUE',
      'notifications.retry'
    ),
    notificationDeadLetterExchange: getOptionalEnv(
      'NOTIFICATION_DLQ_EXCHANGE',
      'notifications.dead-letter'
    ),
    notificationDeadLetterQueue: getOptionalEnv(
      'NOTIFICATION_DLQ',
      'notifications.dead-letter'
    ),
    notificationRetryTtlMs: getPositiveIntegerEnv(
      'NOTIFICATION_RETRY_TTL_MS',
      5000
    ),
    notificationMaxAttempts: getPositiveIntegerEnv(
      'NOTIFICATION_MAX_ATTEMPTS',
      3
    ),
    brokerReconnectDelayMs: getPositiveIntegerEnv(
      'BROKER_RECONNECT_DELAY_MS',
      5000
    )
  };
}
