import { env } from '../../config/env.js';
import { createBrokerClient } from '../messaging/brokerClient.js';
import { getNotificationTopologyConfig } from '../messaging/topology.js';
import { logger } from '../observability/index.js';
import { createSagaReplyConsumer } from './sagaReplyConsumer.js';
import { recoverTimedOutSubscriptionConfirmationSagas } from './subscriptionConfirmationSaga.js';

export { default as sagaRoutes } from './sagaRoutes.js';

const brokerClient = createBrokerClient({
  url: env.rabbitmqUrl,
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});

const replyConsumer = createSagaReplyConsumer({
  brokerClient,
  topology: getNotificationTopologyConfig(env),
  reconnectDelayMs: env.brokerReconnectDelayMs,
  logger
});

let recoveryTimer;
let replyConsumerRetryTimer;
let closing = false;

async function startReplyConsumerWithRetry() {
  if (closing) return;

  try {
    await replyConsumer.start();
  } catch (error) {
    if (closing) return;

    logger.error('Saga reply consumer start failed', { error });
    replyConsumerRetryTimer = setTimeout(
      startReplyConsumerWithRetry,
      env.brokerReconnectDelayMs
    );
  }
}

async function runSagaRecovery() {
  try {
    const recovered = await recoverTimedOutSubscriptionConfirmationSagas({
      timeoutMs: env.sagaTimeoutMs
    });
    if (recovered.length > 0) {
      logger.warn('Recovered timed out subscription confirmation sagas', {
        count: recovered.length
      });
    }
  } catch (error) {
    logger.error('Saga recovery failed', { error });
  }
}

export function startSagaReplyConsumer() {
  closing = false;
  void startReplyConsumerWithRetry();
}

export function startSagaRecovery() {
  if (recoveryTimer) return;
  recoveryTimer = setInterval(runSagaRecovery, env.sagaRecoveryIntervalMs);
  void runSagaRecovery();
}

export function stopSagaRecovery() {
  if (!recoveryTimer) return;
  clearInterval(recoveryTimer);
  recoveryTimer = undefined;
}

export async function closeSagaReplyConsumer() {
  closing = true;
  if (replyConsumerRetryTimer) {
    clearTimeout(replyConsumerRetryTimer);
    replyConsumerRetryTimer = undefined;
  }
  stopSagaRecovery();
  await replyConsumer.close();
  await brokerClient.close();
}

export {
  startSubscriptionConfirmationSaga,
  handleSubscriptionConfirmationSagaReply,
  recoverTimedOutSubscriptionConfirmationSagas
} from './subscriptionConfirmationSaga.js';
