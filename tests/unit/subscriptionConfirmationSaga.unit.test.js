import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@notifier/shared/utils/errors.js';

vi.mock('../../src/modules/notifications/index.js', () => ({
  sendSubscriptionConfirmationGrpc: vi.fn()
}));
vi.mock('../../src/modules/subscriptions/index.js', () => ({
  removePendingSubscription: vi.fn()
}));
vi.mock('../../src/modules/sagas/sagaRepository.js', () => ({
  createSaga: vi.fn(),
  findActiveSagaBySubscriptionId: vi.fn(),
  findSagaById: vi.fn(),
  listTimedOutSagas: vi.fn(),
  updateSagaState: vi.fn()
}));

const notifications = await import('../../src/modules/notifications/index.js');
const subscriptions = await import('../../src/modules/subscriptions/index.js');
const sagaRepository = await import('../../src/modules/sagas/sagaRepository.js');
const {
  dispatchSubscriptionConfirmationSaga,
  handleSubscriptionConfirmationSagaReply,
  recoverTimedOutSubscriptionConfirmationSagas,
  sagaStates,
  startSubscriptionConfirmationSaga,
  subscriptionConfirmationSagaType
} = await import('../../src/modules/sagas/subscriptionConfirmationSaga.js');

describe('subscription confirmation saga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sagaRepository.findActiveSagaBySubscriptionId.mockResolvedValue(null);
    notifications.sendSubscriptionConfirmationGrpc.mockResolvedValue(undefined);
  });

  it('reuses an active saga for the same pending subscription', async () => {
    sagaRepository.findActiveSagaBySubscriptionId.mockResolvedValue({
      id: 'existing-saga',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: { subscriptionId: 10 }
    });

    await expect(startSubscriptionConfirmationSaga({
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmToken: 'confirm-token',
      subscriptionId: 10
    })).resolves.toEqual({ sagaId: 'existing-saga' });

    expect(sagaRepository.createSaga).not.toHaveBeenCalled();
    expect(notifications.sendSubscriptionConfirmationGrpc).not.toHaveBeenCalled();
  });

  it('reuses a concurrently created active saga after database uniqueness conflict', async () => {
    const conflict = Object.assign(new Error('duplicate active saga'), {
      code: '23505',
      constraint: 'idx_sagas_active_subscription_confirmation'
    });
    sagaRepository.findActiveSagaBySubscriptionId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'concurrent-saga',
        type: subscriptionConfirmationSagaType,
        state: sagaStates.started,
        payload: { subscriptionId: 10 }
      });
    sagaRepository.createSaga.mockRejectedValue(conflict);

    await expect(startSubscriptionConfirmationSaga({
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmToken: 'confirm-token',
      subscriptionId: 10
    })).resolves.toEqual({ sagaId: 'concurrent-saga' });

    expect(sagaRepository.findActiveSagaBySubscriptionId).toHaveBeenCalledTimes(2);
    expect(notifications.sendSubscriptionConfirmationGrpc).not.toHaveBeenCalled();
  });

  it('creates saga state, sends notification through gRPC and completes the saga', async () => {
    sagaRepository.createSaga.mockImplementation(async (saga) => saga);
    sagaRepository.updateSagaState
      .mockImplementationOnce(async (id, state) => ({
        id,
        type: subscriptionConfirmationSagaType,
        state,
        payload: {
          email: 'user@example.com',
          repo: 'owner/repo',
          confirmToken: 'confirm-token',
          subscriptionId: 10,
          shouldCompensateSubscription: true
        }
      }))
      .mockImplementationOnce(async (id, state) => ({
        id,
        type: subscriptionConfirmationSagaType,
        state,
        payload: {}
      }));
    sagaRepository.findSagaById.mockResolvedValue({
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.completed,
      payload: {}
    });

    await startSubscriptionConfirmationSaga({
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmToken: 'confirm-token',
      subscriptionId: 10,
      shouldCompensateSubscription: true
    });

    const createdSaga = sagaRepository.createSaga.mock.calls[0][0];
    expect(createdSaga).toMatchObject({
      type: subscriptionConfirmationSagaType,
      state: sagaStates.started,
      payload: {
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token',
        subscriptionId: 10,
        shouldCompensateSubscription: true
      }
    });
    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith(createdSaga.id, sagaStates.notificationPending, {
        error: null,
        expectedState: sagaStates.started
      });
    expect(notifications.sendSubscriptionConfirmationGrpc)
      .toHaveBeenCalledWith('user@example.com', 'confirm-token', 'owner/repo');
    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith(createdSaga.id, sagaStates.completed, {
        completed: true,
        error: null,
        expectedState: sagaStates.notificationPending
      });
  });

  it('propagates the publisher failure status when dispatch cannot reach the broker', async () => {
    sagaRepository.createSaga.mockImplementation(async (saga) => saga);
    sagaRepository.updateSagaState
      .mockImplementationOnce(async (id, state) => ({
        id,
        type: subscriptionConfirmationSagaType,
        state,
        payload: {
          email: 'user@example.com',
          repo: 'owner/repo',
          confirmToken: 'confirm-token',
          subscriptionId: 10,
          shouldCompensateSubscription: true
        }
      }))
      .mockResolvedValueOnce({
        id: 'saga-1',
        type: subscriptionConfirmationSagaType,
        state: sagaStates.compensating,
        payload: { subscriptionId: 10, shouldCompensateSubscription: true }
      })
      .mockResolvedValueOnce({
        id: 'saga-1',
        type: subscriptionConfirmationSagaType,
        state: sagaStates.compensated,
        payload: { subscriptionId: 10, shouldCompensateSubscription: true }
      });
    sagaRepository.findSagaById.mockResolvedValue({
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: { subscriptionId: 10, shouldCompensateSubscription: true }
    });
    notifications.sendSubscriptionConfirmationGrpc
      .mockRejectedValue(new AppError(502, 'Notification service unavailable'));

    await expect(startSubscriptionConfirmationSaga({
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmToken: 'confirm-token',
      subscriptionId: 10,
      shouldCompensateSubscription: true
    })).rejects.toMatchObject({
      status: 502,
      message: 'Notification service unavailable'
    });

    const createdSaga = sagaRepository.createSaga.mock.calls[0][0];
    expect(sagaRepository.updateSagaState).toHaveBeenNthCalledWith(
      1,
      createdSaga.id,
      sagaStates.notificationPending,
      { error: null, expectedState: sagaStates.started }
    );
    expect(sagaRepository.updateSagaState).toHaveBeenNthCalledWith(
      2,
      'saga-1',
      sagaStates.compensating,
      { error: 'Notification service unavailable', expectedState: sagaStates.notificationPending }
    );
    expect(sagaRepository.updateSagaState).toHaveBeenNthCalledWith(
      3,
      'saga-1',
      sagaStates.compensated,
      { error: 'Notification service unavailable', completed: true, expectedState: sagaStates.compensating }
    );
    expect(subscriptions.removePendingSubscription).toHaveBeenCalledWith(10);
  });

  it('does not compensate when completion fails after notification delivery', async () => {
    const pendingSaga = {
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: {
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token',
        subscriptionId: 10,
        shouldCompensateSubscription: false
      }
    };
    sagaRepository.updateSagaState
      .mockResolvedValueOnce(pendingSaga)
      .mockResolvedValueOnce(null);
    sagaRepository.findSagaById.mockResolvedValue(pendingSaga);

    await expect(dispatchSubscriptionConfirmationSaga({ id: 'saga-1' }))
      .rejects.toThrow('Subscription confirmation saga completion conflict');

    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledTimes(2);
    expect(subscriptions.removePendingSubscription).not.toHaveBeenCalled();
  });

  it('does not delete a pending subscription when gRPC delivery times out', async () => {
    const pendingSaga = {
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: {
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token',
        subscriptionId: 10,
        shouldCompensateSubscription: true
      }
    };
    const timeoutError = Object.assign(
      new AppError(504, 'Notification gRPC request timed out'),
      { deliveryUncertain: true }
    );
    notifications.sendSubscriptionConfirmationGrpc.mockRejectedValue(timeoutError);
    sagaRepository.updateSagaState
      .mockResolvedValueOnce(pendingSaga)
      .mockResolvedValueOnce({
        ...pendingSaga,
        state: sagaStates.failed
      });

    await expect(dispatchSubscriptionConfirmationSaga({ id: 'saga-1' }))
      .rejects.toMatchObject({
        status: 504,
        message: 'Notification gRPC request timed out'
      });

    expect(sagaRepository.updateSagaState).toHaveBeenNthCalledWith(
      2,
      'saga-1',
      sagaStates.failed,
      {
        error: 'Notification gRPC request timed out',
        completed: true,
        expectedState: sagaStates.notificationPending
      }
    );
    expect(subscriptions.removePendingSubscription).not.toHaveBeenCalled();
  });

  it('does not mask the original dispatch error when compensation fails', async () => {
    const originalError = new Error('Notification gRPC unavailable');
    const compensationError = new Error('Database unavailable');
    const pendingSaga = {
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: {
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token',
        subscriptionId: 10,
        shouldCompensateSubscription: false
      }
    };
    notifications.sendSubscriptionConfirmationGrpc.mockRejectedValue(originalError);
    sagaRepository.updateSagaState
      .mockResolvedValueOnce(pendingSaga)
      .mockRejectedValueOnce(compensationError);
    sagaRepository.findSagaById.mockResolvedValue(pendingSaga);

    let error;
    try {
      await dispatchSubscriptionConfirmationSaga({ id: 'saga-1' });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error.message).toBe(originalError.message);
    expect(error.cause).toEqual({
      original: originalError,
      compensation: compensationError
    });
  });

  it('marks saga as completed after successful notification reply', async () => {
    sagaRepository.findSagaById.mockResolvedValue({
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: {}
    });

    await handleSubscriptionConfirmationSagaReply({
      sagaId: 'saga-1',
      succeeded: true
    });

    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-1', sagaStates.completed, {
        completed: true,
        error: null,
        expectedState: sagaStates.notificationPending
      });
  });

  it('ignores success replies outside NOTIFICATION_PENDING state', async () => {
    sagaRepository.findSagaById.mockResolvedValue({
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.compensating,
      payload: {}
    });

    await handleSubscriptionConfirmationSagaReply({
      sagaId: 'saga-1',
      succeeded: true
    });

    expect(sagaRepository.updateSagaState).not.toHaveBeenCalled();
  });

  it('compensates a newly created pending subscription after failed notification reply', async () => {
    const saga = {
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: {
        subscriptionId: 10,
        shouldCompensateSubscription: true
      }
    };
    sagaRepository.findSagaById.mockResolvedValue({
      ...saga
    });
    sagaRepository.updateSagaState
      .mockResolvedValueOnce({
        ...saga,
        state: sagaStates.compensating
      })
      .mockResolvedValueOnce({
        ...saga,
        state: sagaStates.compensated
      });

    await handleSubscriptionConfirmationSagaReply({
      sagaId: 'saga-1',
      succeeded: false,
      error: 'SMTP unavailable'
    });

    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-1', sagaStates.compensating, {
        error: 'SMTP unavailable',
        expectedState: sagaStates.notificationPending
      });
    expect(subscriptions.removePendingSubscription).toHaveBeenCalledWith(10);
    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-1', sagaStates.compensated, {
        error: 'SMTP unavailable',
        completed: true,
        expectedState: sagaStates.compensating
      });
    expect(sagaRepository.findSagaById).toHaveBeenCalledTimes(1);
  });

  it('marks saga as failed when compensation action fails', async () => {
    const saga = {
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      payload: {
        subscriptionId: 10,
        shouldCompensateSubscription: true
      }
    };
    sagaRepository.findSagaById.mockResolvedValue({ ...saga });
    sagaRepository.updateSagaState
      .mockResolvedValueOnce({
        ...saga,
        state: sagaStates.compensating
      })
      .mockResolvedValueOnce({
        ...saga,
        state: sagaStates.failed
      });
    subscriptions.removePendingSubscription
      .mockRejectedValue(new Error('Database unavailable'));

    await handleSubscriptionConfirmationSagaReply({
      sagaId: 'saga-1',
      succeeded: false,
      error: 'SMTP unavailable'
    });

    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-1', sagaStates.failed, {
        error: 'Database unavailable',
        completed: true,
        expectedState: sagaStates.compensating
      });
  });

  it('continues timed-out saga recovery after one saga fails', async () => {
    const firstSaga = {
      id: 'saga-1',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      error: 'SMTP refused',
      payload: {}
    };
    const secondSaga = {
      id: 'saga-2',
      type: subscriptionConfirmationSagaType,
      state: sagaStates.notificationPending,
      error: null,
      payload: {}
    };
    sagaRepository.listTimedOutSagas.mockResolvedValue([firstSaga, secondSaga]);
    sagaRepository.updateSagaState
      .mockRejectedValueOnce(new Error('Temporary database error'))
      .mockResolvedValueOnce({
        ...secondSaga,
        state: sagaStates.compensating
      })
      .mockResolvedValueOnce({
        ...secondSaga,
        state: sagaStates.failed
      });

    const result = await recoverTimedOutSubscriptionConfirmationSagas();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'saga-1',
      error: 'Temporary database error'
    });
    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-1', sagaStates.compensating, {
        error: 'Subscription confirmation saga timed out after previous error: SMTP refused',
        expectedState: sagaStates.notificationPending
      });
    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-2', sagaStates.compensating, {
        error: 'Subscription confirmation saga timed out',
        expectedState: sagaStates.notificationPending
      });
  });
});
