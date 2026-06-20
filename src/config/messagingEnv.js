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
    sagaReplyExchange: getOptionalEnv(
      'SAGA_REPLY_EXCHANGE',
      'saga.replies'
    ),
    sagaReplyQueue: getOptionalEnv(
      'SAGA_REPLY_QUEUE',
      'saga.replies'
    ),
    sagaReplyRetryExchange: getOptionalEnv(
      'SAGA_REPLY_RETRY_EXCHANGE',
      'saga.replies.retry'
    ),
    sagaReplyRetryQueue: getOptionalEnv(
      'SAGA_REPLY_RETRY_QUEUE',
      'saga.replies.retry'
    ),
    sagaReplyDeadLetterExchange: getOptionalEnv(
      'SAGA_REPLY_DLQ_EXCHANGE',
      'saga.replies.dead-letter'
    ),
    sagaReplyDeadLetterQueue: getOptionalEnv(
      'SAGA_REPLY_DLQ',
      'saga.replies.dead-letter'
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
    ),
    sagaTimeoutMs: getPositiveIntegerEnv(
      'SAGA_TIMEOUT_MS',
      600000
    ),
    sagaRecoveryIntervalMs: getPositiveIntegerEnv(
      'SAGA_RECOVERY_INTERVAL_MS',
      60000
    )
  };
}
