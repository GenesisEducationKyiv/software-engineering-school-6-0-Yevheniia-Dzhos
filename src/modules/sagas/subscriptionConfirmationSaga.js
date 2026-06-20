import { randomUUID } from 'node:crypto';
import { sendSubscriptionConfirmation } from '../notifications/index.js';
import { deletePendingSubscription } from '../subscriptions/subscriptionRepository.js';
import {
  createSaga,
  createSagaWithClient,
  findActiveSagaBySubscriptionId,
  findSagaById,
  listTimedOutSagas,
  updateSagaState
} from './sagaRepository.js';

export const subscriptionConfirmationSagaType = 'subscription-confirmation';

export const sagaStates = {
  started: 'STARTED',
  notificationPending: 'NOTIFICATION_PENDING',
  completed: 'COMPLETED',
  compensating: 'COMPENSATING',
  compensated: 'COMPENSATED',
  failed: 'FAILED'
};

export const sagaTimeoutDefaults = {
  timeoutMs: 10 * 60 * 1000,
  batchSize: 20
};

const terminalStates = new Set([
  sagaStates.completed,
  sagaStates.compensated,
  sagaStates.failed
]);

const activeStates = [
  sagaStates.started,
  sagaStates.notificationPending,
  sagaStates.compensating
];

async function updateSagaStateOrReload(id, state, options) {
  const updated = await updateSagaState(id, state, options);
  return updated || findSagaById(id);
}

export async function startSubscriptionConfirmationSaga({
  email,
  repo,
  confirmToken,
  subscriptionId,
  shouldCompensateSubscription = false
}) {
  const activeSaga = await findActiveSagaBySubscriptionId({
    type: subscriptionConfirmationSagaType,
    subscriptionId,
    states: activeStates
  });

  if (activeSaga) return { sagaId: activeSaga.id };

  const sagaId = randomUUID();
  const saga = await createSubscriptionConfirmationSaga({
    sagaId,
    email,
    repo,
    confirmToken,
    subscriptionId,
    shouldCompensateSubscription
  });

  await dispatchSubscriptionConfirmationSaga(saga);

  return { sagaId };
}

export async function createSubscriptionConfirmationSaga({
  sagaId = randomUUID(),
  email,
  repo,
  confirmToken,
  subscriptionId,
  shouldCompensateSubscription = false,
  client
}) {
  const payload = {
    email,
    repo,
    confirmToken,
    subscriptionId,
    shouldCompensateSubscription
  };
  const create = client ? createSagaWithClient.bind(null, client) : createSaga;

  return create({
    id: sagaId,
    type: subscriptionConfirmationSagaType,
    state: sagaStates.started,
    payload
  });
}

export async function dispatchSubscriptionConfirmationSaga(saga) {
  try {
    const pendingSaga = await updateSagaState(saga.id, sagaStates.notificationPending, {
      error: null,
      expectedState: sagaStates.started
    });
    if (!pendingSaga) return findSagaById(saga.id);

    await sendSubscriptionConfirmation(
      pendingSaga.payload.email,
      pendingSaga.payload.confirmToken,
      pendingSaga.payload.repo,
      { sagaId: pendingSaga.id }
    );
  } catch (error) {
    await compensateSubscriptionConfirmationSaga(saga.id, error);
    throw error;
  }

  return findSagaById(saga.id);
}

export async function handleSubscriptionConfirmationSagaReply({
  sagaId,
  succeeded,
  error
}) {
  const saga = await findSagaById(sagaId);

  if (!saga || saga.type !== subscriptionConfirmationSagaType) return null;
  if (terminalStates.has(saga.state)) return saga;

  if (succeeded) {
    if (saga.state !== sagaStates.notificationPending) return saga;

    return updateSagaStateOrReload(sagaId, sagaStates.completed, {
      completed: true,
      error: null,
      expectedState: saga.state
    });
  }

  if (saga.state !== sagaStates.notificationPending) return saga;

  return compensateLoadedSubscriptionConfirmationSaga(
    saga,
    new Error(error || 'Subscription confirmation notification failed')
  );
}

export async function compensateSubscriptionConfirmationSaga(sagaId, error) {
  const saga = await findSagaById(sagaId);

  if (!saga) return null;
  if (terminalStates.has(saga.state)) return saga;

  return compensateLoadedSubscriptionConfirmationSaga(saga, error);
}

async function compensateLoadedSubscriptionConfirmationSaga(saga, error) {
  const compensatingSaga = await updateSagaState(saga.id, sagaStates.compensating, {
    error: error.message,
    expectedState: saga.state
  });

  if (!compensatingSaga) return findSagaById(saga.id);

  if (
    compensatingSaga.payload?.shouldCompensateSubscription
    && compensatingSaga.payload?.subscriptionId
  ) {
    try {
      await deletePendingSubscription(compensatingSaga.payload.subscriptionId);
    } catch (compensationError) {
      return updateSagaStateOrReload(saga.id, sagaStates.failed, {
        error: compensationError.message,
        completed: true,
        expectedState: sagaStates.compensating
      });
    }

    return updateSagaStateOrReload(saga.id, sagaStates.compensated, {
      error: error.message,
      completed: true,
      expectedState: sagaStates.compensating
    });
  }

  return updateSagaStateOrReload(saga.id, sagaStates.failed, {
    error: error.message,
    completed: true,
    expectedState: sagaStates.compensating
  });
}

export async function recoverTimedOutSubscriptionConfirmationSagas({
  timeoutMs = sagaTimeoutDefaults.timeoutMs,
  batchSize = sagaTimeoutDefaults.batchSize
} = {}) {
  const sagas = await listTimedOutSagas({
    states: [sagaStates.notificationPending, sagaStates.compensating],
    olderThan: timeoutMs,
    limit: batchSize
  });

  const recovered = [];

  for (const saga of sagas) {
    if (saga.type !== subscriptionConfirmationSagaType) continue;

    try {
      const reason = saga.error
        ? `Subscription confirmation saga timed out after previous error: ${saga.error}`
        : 'Subscription confirmation saga timed out';
      const result = await compensateLoadedSubscriptionConfirmationSaga(
        saga,
        new Error(reason)
      );
      recovered.push(result);
    } catch (error) {
      recovered.push({
        id: saga.id,
        type: saga.type,
        state: saga.state,
        error: error.message
      });
    }
  }

  return recovered;
}
