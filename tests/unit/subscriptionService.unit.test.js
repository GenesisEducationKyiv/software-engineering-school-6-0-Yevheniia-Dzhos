import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/utils/errors.js';

vi.mock('../../src/modules/releaseTracking/index.js', () => ({
  trackRepository: vi.fn()
}));
vi.mock('../../src/modules/subscriptions/subscriptionTokenService.js', () => ({
  createSubscriptionTokens: vi.fn()
}));
vi.mock('../../src/db/client.js', () => ({
  withTransaction: vi.fn(async (work) => work({ query: vi.fn() }))
}));
vi.mock('../../src/modules/sagas/subscriptionConfirmationSaga.js', () => ({
  createSubscriptionConfirmationSaga: vi.fn(),
  dispatchSubscriptionConfirmationSaga: vi.fn(),
  startSubscriptionConfirmationSaga: vi.fn()
}));
vi.mock('../../src/modules/subscriptions/subscriptionRepository.js', () => ({
  findActiveSubscription: vi.fn(),
  createSubscriptionRecord: vi.fn(),
  deletePendingSubscription: vi.fn(),
  findSubscriptionByToken: vi.fn(),
  confirmSubscriptionRecord: vi.fn(),
  unsubscribeSubscriptionRecord: vi.fn(),
  listSubscriptionsByEmail: vi.fn()
}));

const releaseTrackingModule = await import('../../src/modules/releaseTracking/index.js');
const dbClient = await import('../../src/db/client.js');
const tokenService = await import('../../src/modules/subscriptions/subscriptionTokenService.js');
const sagaModule = await import('../../src/modules/sagas/subscriptionConfirmationSaga.js');
const subscriptionRepository = await import('../../src/modules/subscriptions/subscriptionRepository.js');
const subscriptionService = await import('../../src/modules/subscriptions/subscriptionService.js');

describe('subscription service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a subscription through repository, token and notification collaborators', async () => {
    releaseTrackingModule.trackRepository.mockResolvedValue({ id: 7 });
    subscriptionRepository.findActiveSubscription.mockResolvedValue(null);
    tokenService.createSubscriptionTokens.mockReturnValue({
      confirmToken: 'confirm-token-123',
      unsubscribeToken: 'unsubscribe-token-123'
    });
    subscriptionRepository.createSubscriptionRecord.mockResolvedValue({ id: 101 });
    sagaModule.createSubscriptionConfirmationSaga.mockResolvedValue({ id: 'saga-1' });

    await subscriptionService.createSubscription({
      email: ' User@Example.com ',
      repo: 'owner/repo'
    });

    expect(releaseTrackingModule.trackRepository).toHaveBeenCalledWith('owner/repo');
    expect(subscriptionRepository.createSubscriptionRecord)
      .toHaveBeenCalledWith(
        'user@example.com',
        7,
        'confirm-token-123',
        'unsubscribe-token-123',
        expect.any(Object)
      );
    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(sagaModule.createSubscriptionConfirmationSaga)
      .toHaveBeenCalledWith({
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token-123',
        subscriptionId: 101,
        shouldCompensateSubscription: true,
        client: expect.any(Object)
      });
    expect(sagaModule.dispatchSubscriptionConfirmationSaga)
      .toHaveBeenCalledWith({ id: 'saga-1' });
  });

  it('rejects duplicate active subscriptions', async () => {
    releaseTrackingModule.trackRepository.mockResolvedValue({ id: 7 });
    subscriptionRepository.findActiveSubscription.mockResolvedValue({ id: 99, confirmed: true });

    await expect(subscriptionService.createSubscription({
      email: 'user@example.com',
      repo: 'owner/repo'
    })).rejects.toMatchObject({
      status: 409,
      message: 'Email already subscribed to this repository'
    });
  });

  it('resends confirmation for an existing pending subscription', async () => {
    releaseTrackingModule.trackRepository.mockResolvedValue({ id: 7 });
    subscriptionRepository.findActiveSubscription.mockResolvedValue({
      id: 99,
      confirmed: false,
      confirm_token: 'existing-confirm-token'
    });

    await subscriptionService.createSubscription({
      email: 'user@example.com',
      repo: 'owner/repo'
    });

    expect(tokenService.createSubscriptionTokens).not.toHaveBeenCalled();
    expect(subscriptionRepository.createSubscriptionRecord).not.toHaveBeenCalled();
    expect(sagaModule.startSubscriptionConfirmationSaga)
      .toHaveBeenCalledWith({
        email: 'user@example.com',
        repo: 'owner/repo',
        confirmToken: 'existing-confirm-token',
        subscriptionId: 99
      });
  });

  it('confirms subscriptions by valid token', async () => {
    subscriptionRepository.findSubscriptionByToken.mockResolvedValue({ id: 3 });

    await subscriptionService.confirmSubscription('valid-token-123');

    expect(subscriptionRepository.findSubscriptionByToken)
      .toHaveBeenCalledWith('confirm_token', 'valid-token-123');
    expect(subscriptionRepository.confirmSubscriptionRecord).toHaveBeenCalledWith(3);
  });

  it('unsubscribes by valid token', async () => {
    subscriptionRepository.findSubscriptionByToken.mockResolvedValue({ id: 4 });

    await subscriptionService.unsubscribe('valid-token-456');

    expect(subscriptionRepository.findSubscriptionByToken)
      .toHaveBeenCalledWith('unsubscribe_token', 'valid-token-456');
    expect(subscriptionRepository.unsubscribeSubscriptionRecord).toHaveBeenCalledWith(4);
  });

  it('returns a 404 AppError when tokens do not exist', async () => {
    subscriptionRepository.findSubscriptionByToken.mockResolvedValue(null);

    await expect(subscriptionService.confirmSubscription('valid-token-123'))
      .rejects.toMatchObject({ status: 404 });
    await expect(subscriptionService.unsubscribe('valid-token-456'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('lists normalized subscriptions for a user', async () => {
    subscriptionRepository.listSubscriptionsByEmail.mockResolvedValue([
      { email: 'user@example.com', repo: 'owner/repo', confirmed: true, last_seen_tag: 'v2.0.0' }
    ]);

    await expect(subscriptionService.listSubscriptions(' User@Example.com ')).resolves.toEqual([
      { email: 'user@example.com', repo: 'owner/repo', confirmed: true, last_seen_tag: 'v2.0.0' }
    ]);
    expect(subscriptionRepository.listSubscriptionsByEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('fails fast on invalid create input without external calls', async () => {
    await expect(subscriptionService.createSubscription({ email: 'bad', repo: 'bad' }))
      .rejects.toBeInstanceOf(AppError);
    expect(releaseTrackingModule.trackRepository).not.toHaveBeenCalled();
  });
});
