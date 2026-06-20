import { randomUUID } from 'node:crypto';
import { sendSubscriptionConfirmation } from '../notifications/index.js';
import { deletePendingSubscription } from '../subscriptions/subscriptionRepository.js';
import {
  createSaga,
  findSagaById,
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

const terminalStates = new Set([
  sagaStates.completed,
  sagaStates.compensated,
  sagaStates.failed
]);

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
  const sagaId = randomUUID();
  const payload = {
    email,
    repo,
    confirmToken,
    subscriptionId,
    shouldCompensateSubscription
  };

  await createSaga({
    id: sagaId,
    type: subscriptionConfirmationSagaType,
    state: sagaStates.started,
    payload
  });

  try {
    await updateSagaState(sagaId, sagaStates.notificationPending, {
      expectedState: sagaStates.started
    });
    await sendSubscriptionConfirmation(email, confirmToken, repo, { sagaId });
  } catch (error) {
    await compensateSubscriptionConfirmationSaga(sagaId, error);
    throw error;
  }

  return { sagaId };
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
    return updateSagaStateOrReload(sagaId, sagaStates.completed, {
      completed: true,
      expectedState: saga.state
    });
  }

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
    await deletePendingSubscription(compensatingSaga.payload.subscriptionId);
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
