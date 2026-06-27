import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/utils/errors.js';

vi.mock('../../src/services/githubService.js', () => ({
  ensureRepositoryExists: vi.fn(),
  fetchLatestReleaseTag: vi.fn()
}));
vi.mock('../../src/services/subscriptionTokenService.js', () => ({
  createSubscriptionTokens: vi.fn()
}));
vi.mock('../../src/services/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn()
}));
vi.mock('../../src/repositories/trackedRepositoryRepository.js', () => ({
  upsertTrackedRepository: vi.fn(),
  findTrackedRepositoryByFullName: vi.fn()
}));
vi.mock('../../src/repositories/subscriptionRepository.js', () => ({
  findActiveSubscription: vi.fn(),
  findUnsubscribedSubscription: vi.fn(),
  createSubscriptionRecord: vi.fn(),
  reactivateSubscriptionRecord: vi.fn(),
  findSubscriptionByToken: vi.fn(),
  confirmSubscriptionRecord: vi.fn(),
  unsubscribeSubscriptionRecord: vi.fn(),
  listSubscriptionsByEmail: vi.fn()
}));

const githubService = await import('../../src/services/githubService.js');
const tokenService = await import('../../src/services/subscriptionTokenService.js');
const notificationService = await import('../../src/services/notificationService.js');
const trackedRepositoryRepository = await import('../../src/repositories/trackedRepositoryRepository.js');
const subscriptionRepository = await import('../../src/repositories/subscriptionRepository.js');
const subscriptionService = await import('../../src/services/subscriptionService.js');

describe('subscription service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a subscription through repository, token and notification collaborators', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.2.3');
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue({ id: 7 });
    subscriptionRepository.findActiveSubscription.mockResolvedValue(null);
    subscriptionRepository.findUnsubscribedSubscription.mockResolvedValue(null);
    tokenService.createSubscriptionTokens.mockReturnValue({
      confirmToken: 'confirm-token-123',
      unsubscribeToken: 'unsubscribe-token-123'
    });

    await subscriptionService.createSubscription({
      email: ' User@Example.com ',
      repo: 'owner/repo'
    });

    expect(githubService.ensureRepositoryExists).toHaveBeenCalledWith('owner/repo');
    expect(trackedRepositoryRepository.upsertTrackedRepository)
      .toHaveBeenCalledWith('owner/repo', 'owner', 'repo', 'v1.2.3');
    expect(subscriptionRepository.createSubscriptionRecord)
      .toHaveBeenCalledWith('user@example.com', 7, 'confirm-token-123', 'unsubscribe-token-123');
    expect(notificationService.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'confirm-token-123', 'owner/repo');
  });

  it('rejects duplicate active subscriptions', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue(null);
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue({ id: 7 });
    subscriptionRepository.findActiveSubscription.mockResolvedValue({ id: 99 });

    await expect(subscriptionService.createSubscription({
      email: 'user@example.com',
      repo: 'owner/repo'
    })).rejects.toMatchObject({
      status: 409,
      message: 'Email already subscribed to this repository'
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
    expect(githubService.ensureRepositoryExists).not.toHaveBeenCalled();
  });
});
