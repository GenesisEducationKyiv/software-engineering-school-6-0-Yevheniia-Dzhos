import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/notifications/index.js', () => ({
  sendSubscriptionConfirmation: vi.fn()
}));
vi.mock('../../src/modules/subscriptions/subscriptionRepository.js', () => ({
  deletePendingSubscription: vi.fn()
}));
vi.mock('../../src/modules/sagas/sagaRepository.js', () => ({
  createSaga: vi.fn(),
  findSagaById: vi.fn(),
  updateSagaState: vi.fn()
}));

const notifications = await import('../../src/modules/notifications/index.js');
const subscriptionRepository = await import(
  '../../src/modules/subscriptions/subscriptionRepository.js'
);
const sagaRepository = await import('../../src/modules/sagas/sagaRepository.js');
const {
  handleSubscriptionConfirmationSagaReply,
  sagaStates,
  startSubscriptionConfirmationSaga,
  subscriptionConfirmationSagaType
} = await import('../../src/modules/sagas/subscriptionConfirmationSaga.js');

describe('subscription confirmation saga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates saga state and publishes a notification command with saga id', async () => {
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
        expectedState: sagaStates.started
      });
    expect(notifications.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'confirm-token', 'owner/repo', {
        sagaId: createdSaga.id
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
        expectedState: sagaStates.notificationPending
      });
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
    expect(subscriptionRepository.deletePendingSubscription).toHaveBeenCalledWith(10);
    expect(sagaRepository.updateSagaState)
      .toHaveBeenCalledWith('saga-1', sagaStates.compensated, {
        error: 'SMTP unavailable',
        completed: true,
        expectedState: sagaStates.compensating
      });
    expect(sagaRepository.findSagaById).toHaveBeenCalledTimes(1);
  });
});
